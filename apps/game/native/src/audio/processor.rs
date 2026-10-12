use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use dywapitchtrack::DywaPitchTracker;
use ringbuf::{
    traits::{Consumer, Producer, Split},
    HeapCons, HeapProd, HeapRb,
};

use super::analysis::{Analyzer, Frame};
use super::clock::{now_ns, SampleClock};
use super::types::MicrophoneOptions;

/// Window size for a single pitch computation, decoupled from song BPM.
/// 2048 samples (~43 ms at 48 kHz) covers the whole singable range down to
/// ~C2 (~65 Hz) while staying cheap. Keeping it independent of BPM stops fast
/// songs from shrinking the window below the low-voice detection threshold.
const MAX_PITCH_SAMPLES: usize = 2048;

/// Overlapping sub-windows analyzed per `get_pitch` call; the median of their
/// results guards against momentary glitches and octave errors.
const SUB_WINDOW_COUNT: usize = 3;

const WINDOW_HEADROOM_SAMPLES: usize = 4096;

/// Lock-free producer half of a microphone's audio queue, written by the
/// real-time `cpal` callback. Kept separate from [`Processor`] so the audio
/// thread never blocks on the pitch computation that holds the processor lock.
pub struct AudioInput {
    producer: HeapProd<f32>,
    gain: f32,
    /// When the newest samples arrived ([`now_ns`]), for timing the frames made from them.
    last_push_ns: Arc<AtomicU64>,
}

impl AudioInput {
    pub fn push_audio_data(&mut self, data: &[f32]) {
        for &sample in data {
            let _ = self
                .producer
                .try_push((sample * self.gain).clamp(-1.0, 1.0));
        }
        self.last_push_ns.store(now_ns(), Ordering::Release);
    }
}

/// A [`Frame`] placed in time: when its last sample was captured, on the [`now_ns`] clock.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct TimedFrame {
    pub time_ns: u64,
    pub hz: f32,
    pub level: f32,
}

pub struct Processor {
    consumer: HeapCons<f32>,
    /// Most recent samples, oldest at index 0.
    window: Vec<f32>,
    capacity: usize,
    pitchtracker: DywaPitchTracker,
    options: MicrophoneOptions,
    sample_rate: u32,
    /// Analyses everything drained, continuously (see [`Processor::take_frames`]).
    analyzer: Analyzer,
    frames: Vec<TimedFrame>,
    last_push_ns: Arc<AtomicU64>,
    /// Times the frames from the sample count, smoothing out callback jitter.
    sample_clock: SampleClock,
    last_frame_ns: u64,
    /// Scratch for the frames one drain completes.
    new_frames: Vec<Frame>,
}

impl Processor {
    pub fn new(options: MicrophoneOptions, sample_rate: u32) -> (Self, AudioInput) {
        // Must cover a full pitch window plus headroom for overlapping
        // sub-windows. Mic-delay compensation is applied per player on the
        // TypeScript side (the analyzed beat is offset by the mic delay), so
        // the processor always analyzes the most recent audio.
        let capacity = MAX_PITCH_SAMPLES + WINDOW_HEADROOM_SAMPLES;

        let queue = HeapRb::<f32>::new(capacity);
        let (producer, consumer) = queue.split();

        let mut pitchtracker = DywaPitchTracker::new();
        pitchtracker.sample_rate_hz = sample_rate as i32;

        let gain = options.gain;
        let last_push_ns = Arc::new(AtomicU64::new(now_ns()));

        let processor = Self {
            consumer,
            window: Vec::with_capacity(capacity),
            capacity,
            pitchtracker,
            analyzer: Analyzer::new(sample_rate, options.threshold),
            options,
            sample_rate,
            frames: Vec::new(),
            last_push_ns: last_push_ns.clone(),
            sample_clock: SampleClock::default(),
            last_frame_ns: 0,
            new_frames: Vec::new(),
        };

        let input = AudioInput {
            producer,
            gain,
            last_push_ns,
        };

        (processor, input)
    }

    /// Move newly captured samples from the queue into the sliding window,
    /// dropping the oldest beyond `capacity`, and into the continuous analysis.
    fn drain_into_window(&mut self) {
        // Read before draining: samples pushed meanwhile only make the frames look a
        // callback older than they are, never newer.
        let newest_ns = self.last_push_ns.load(Ordering::Acquire);
        let mut tmp = [0.0f32; 1024];
        loop {
            let n = self.consumer.pop_slice(&mut tmp);
            if n == 0 {
                break;
            }
            self.window.extend_from_slice(&tmp[..n]);
            self.analyzer.push(&tmp[..n], &mut self.new_frames);
        }

        // Everything drained had arrived by `newest_ns`.
        let total = self.analyzer.total();
        if total > 0 {
            self.sample_clock
                .observe(newest_ns, total, self.sample_rate);
        }
        for frame in self.new_frames.drain(..) {
            // The estimate only ever moves earlier by a little; never let a frame go back in time.
            let time_ns = self
                .sample_clock
                .time_of(frame.end_sample, self.sample_rate)
                .max(self.last_frame_ns + 1);
            self.last_frame_ns = time_ns;
            self.frames.push(TimedFrame {
                time_ns,
                hz: frame.hz,
                level: frame.level,
            });
        }

        if self.window.len() > self.capacity {
            let excess = self.window.len() - self.capacity;
            self.window.drain(0..excess);
        }
    }

    /// Frames analysed since the last call, oldest first. Called regularly by the analysis
    /// worker, which also keeps the queue from overflowing between beats.
    pub fn take_frames(&mut self, out: &mut Vec<TimedFrame>) {
        self.drain_into_window();
        out.append(&mut self.frames);
    }

    /// Median detected frequency (Hz) over the last `window_ms`, or `-1.0` if
    /// no pitch was found. Always analyzes the most recent audio; per-player
    /// mic-delay compensation is handled on the TypeScript side by scoring the
    /// detected pitch against an earlier beat.
    pub fn get_pitch(&mut self, window_ms: f32) -> f32 {
        self.drain_into_window();

        let window_samples = self.window_samples(window_ms);
        let available = self.window.len();

        if available < window_samples + SUB_WINDOW_COUNT {
            return -1.0;
        }

        let window_end = available;

        // Spread overlapping sub-windows back from `window_end`.
        let step = if SUB_WINDOW_COUNT > 1 {
            window_samples / SUB_WINDOW_COUNT
        } else {
            0
        };

        let mut pitches: Vec<f32> = Vec::with_capacity(SUB_WINDOW_COUNT);
        let mut had_signal = false;

        for i in 0..SUB_WINDOW_COUNT {
            let offset = step * i;
            if window_end < offset + window_samples {
                continue;
            }
            let end = window_end - offset;
            let start = end - window_samples;

            if !self.above_noise_threshold(start, window_samples) {
                continue;
            }
            had_signal = true;

            let pitch = self
                .pitchtracker
                .compute_pitch(&self.window, start, window_samples);

            if pitch > 0.0 {
                pitches.push(pitch);
            }
        }

        if pitches.is_empty() {
            // Only reset on true silence; keep history through unvoiced/breath
            // gaps so brief mid-note dropouts don't make tracking jumpy.
            if !had_signal {
                self.pitchtracker.clear_pitch_history();
            }
            return -1.0;
        }

        median(&mut pitches)
    }

    /// Peak level of the most recent window, for the audio-level meter.
    pub fn get_level(&mut self) -> f32 {
        self.drain_into_window();

        let window_size = MAX_PITCH_SAMPLES.min(self.window.len());
        if window_size == 0 {
            return 0.0;
        }
        let start = self.window.len() - window_size;
        self.window[start..]
            .iter()
            .fold(0.0f32, |max, &s| max.max(s.abs()))
    }

    fn window_samples(&self, window_ms: f32) -> usize {
        let requested = ms_to_samples(window_ms, self.sample_rate);
        requested.clamp(SUB_WINDOW_COUNT, MAX_PITCH_SAMPLES)
    }

    fn above_noise_threshold(&self, start_sample: usize, window_samples: usize) -> bool {
        let min_threshold = self.options.threshold / 100.0;
        let end_sample = start_sample + window_samples;

        if end_sample > self.window.len() {
            return false;
        }

        self.window[start_sample..end_sample]
            .iter()
            .any(|&sample| sample.abs() > min_threshold)
    }
}

fn ms_to_samples(ms: f32, sample_rate: u32) -> usize {
    if ms <= 0.0 {
        return 0;
    }
    ((ms / 1000.0) * sample_rate as f32).round() as usize
}

/// Median of `values`; sorts the slice in place.
fn median(values: &mut [f32]) -> f32 {
    if values.is_empty() {
        return -1.0;
    }
    values.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    let mid = values.len() / 2;
    if values.len() % 2 == 0 {
        (values[mid - 1] + values[mid]) / 2.0
    } else {
        values[mid]
    }
}
