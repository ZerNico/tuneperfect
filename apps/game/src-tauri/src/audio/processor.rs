use dywapitchtrack::DywaPitchTracker;
use ringbuf::{
    traits::{Consumer, Producer, Split},
    HeapCons, HeapProd, HeapRb,
};

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
}

impl AudioInput {
    pub fn push_audio_data(&mut self, data: &[f32]) {
        for &sample in data {
            let _ = self
                .producer
                .try_push((sample * self.gain).clamp(-1.0, 1.0));
        }
    }
}

pub struct Processor {
    consumer: HeapCons<f32>,
    /// Most recent samples, oldest at index 0.
    window: Vec<f32>,
    capacity: usize,
    pitchtracker: DywaPitchTracker,
    options: MicrophoneOptions,
    sample_rate: u32,
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

        let processor = Self {
            consumer,
            window: Vec::with_capacity(capacity),
            capacity,
            pitchtracker,
            options,
            sample_rate,
        };

        let input = AudioInput { producer, gain };

        (processor, input)
    }

    /// Move newly captured samples from the queue into the sliding window,
    /// dropping the oldest beyond `capacity`.
    fn drain_into_window(&mut self) {
        let mut tmp = [0.0f32; 1024];
        loop {
            let n = self.consumer.pop_slice(&mut tmp);
            if n == 0 {
                break;
            }
            self.window.extend_from_slice(&tmp[..n]);
        }

        if self.window.len() > self.capacity {
            let excess = self.window.len() - self.capacity;
            self.window.drain(0..excess);
        }
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
