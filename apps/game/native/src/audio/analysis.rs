//! Continuous pitch analysis: frames at a fixed rate, for the live pitch stream.

use dywapitchtrack::DywaPitchTracker;

/// Samples per analysis, the same size the per-beat path analyses at most.
pub const WINDOW: usize = 2048;
/// Frames per second.
pub const FRAME_RATE: u32 = 100;

/// One analysis of the `WINDOW` samples ending at `end_sample` (counted from the start of
/// the recording).
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Frame {
    pub end_sample: u64,
    /// Detected pitch in Hz, or -1 without one (silence or no clear pitch).
    pub hz: f32,
    /// Peak amplitude of the window, after gain.
    pub level: f32,
}

/// Turns a stream of samples into frames on a fixed grid: one every `sample_rate / FRAME_RATE`
/// samples, however the samples arrive. Frames line up with the audio, not with when the caller
/// happens to wake up.
pub struct Analyzer {
    hop: u64,
    /// Peak amplitude a window must exceed to count as sound (the mic's noise threshold).
    threshold: f32,
    /// Samples from `buffer_start` on: everything a pending frame still needs.
    buffer: Vec<f32>,
    buffer_start: u64,
    total: u64,
    next_end: u64,
    tracker: DywaPitchTracker,
}

impl Analyzer {
    /// `threshold` is in percent of full scale, like the microphone setting.
    pub fn new(sample_rate: u32, threshold: f32) -> Self {
        let hop = u64::from((sample_rate / FRAME_RATE).max(1));
        let mut tracker = DywaPitchTracker::new();
        tracker.sample_rate_hz = sample_rate as i32;

        Self {
            hop,
            threshold: threshold / 100.0,
            buffer: Vec::with_capacity(WINDOW * 2),
            buffer_start: 0,
            total: 0,
            // The first frame needs a full window behind it.
            next_end: (WINDOW as u64).div_ceil(hop) * hop,
            tracker,
        }
    }

    /// Samples seen so far.
    pub fn total(&self) -> u64 {
        self.total
    }

    /// Feeds samples in order and appends every frame they complete to `out`.
    pub fn push(&mut self, samples: &[f32], out: &mut Vec<Frame>) {
        self.buffer.extend_from_slice(samples);
        self.total += samples.len() as u64;

        while self.next_end <= self.total {
            let start = (self.next_end - WINDOW as u64 - self.buffer_start) as usize;
            out.push(self.analyze(start));
            self.next_end += self.hop;
        }

        // Drop what no pending frame needs, in blocks so it isn't a shift per call.
        let needed_from = self.next_end - WINDOW as u64;
        let unneeded = (needed_from - self.buffer_start) as usize;
        if unneeded >= WINDOW {
            self.buffer.drain(..unneeded);
            self.buffer_start = needed_from;
        }
    }

    fn analyze(&mut self, start: usize) -> Frame {
        let window = &self.buffer[start..start + WINDOW];
        let level = window.iter().fold(0.0f32, |peak, &s| peak.max(s.abs()));

        let hz = if level > self.threshold {
            let hz = self.tracker.compute_pitch(&self.buffer, start, WINDOW);
            if hz > 0.0 {
                hz
            } else {
                -1.0
            }
        } else {
            // A fresh start after silence, like the per-beat path.
            self.tracker.clear_pitch_history();
            -1.0
        };

        Frame {
            end_sample: self.next_end,
            hz,
            level,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const RATE: u32 = 48_000;

    fn sine(hz: f32, seconds: f32, amplitude: f32) -> Vec<f32> {
        let count = (seconds * RATE as f32) as usize;
        (0..count)
            .map(|i| (i as f32 * hz * std::f32::consts::TAU / RATE as f32).sin() * amplitude)
            .collect()
    }

    fn frames_in_chunks(samples: &[f32], chunk: usize) -> Vec<Frame> {
        let mut analyzer = Analyzer::new(RATE, 1.0);
        let mut frames = Vec::new();
        for part in samples.chunks(chunk) {
            analyzer.push(part, &mut frames);
        }
        frames
    }

    fn cents(a: f32, b: f32) -> f32 {
        1200.0 * (a / b).log2()
    }

    #[test]
    fn detects_a_steady_pitch_in_every_frame() {
        for hz in [110.0, 220.0, 440.0] {
            let frames = frames_in_chunks(&sine(hz, 1.0, 0.5), 256);
            assert!(!frames.is_empty());
            for frame in &frames {
                assert!(
                    cents(frame.hz, hz).abs() < 5.0,
                    "{} Hz detected as {}",
                    hz,
                    frame.hz
                );
            }
        }
    }

    #[test]
    fn frames_follow_the_sample_grid_however_samples_arrive() {
        let samples = sine(220.0, 2.0, 0.5);
        let reference = frames_in_chunks(&samples, 4096);
        for chunk in [1, 441, 480, 1000] {
            assert_eq!(
                frames_in_chunks(&samples, chunk),
                reference,
                "chunks of {chunk}"
            );
        }

        // One frame per 10 ms once the first window is full.
        let hop = u64::from(RATE / FRAME_RATE);
        assert_eq!(reference[0].end_sample, (WINDOW as u64).div_ceil(hop) * hop);
        for pair in reference.windows(2) {
            assert_eq!(pair[1].end_sample - pair[0].end_sample, hop);
        }
        assert_eq!(reference.last().unwrap().end_sample, samples.len() as u64);
    }

    #[test]
    fn silence_and_quiet_noise_have_no_pitch() {
        let frames = frames_in_chunks(&vec![0.0; RATE as usize], 512);
        assert!(frames.iter().all(|f| f.hz == -1.0 && f.level == 0.0));

        // Below the 1% threshold.
        let frames = frames_in_chunks(&sine(220.0, 0.5, 0.005), 512);
        assert!(frames.iter().all(|f| f.hz == -1.0));
    }

    #[test]
    fn level_is_the_window_peak() {
        let frames = frames_in_chunks(&sine(220.0, 0.5, 0.25), 512);
        for frame in frames {
            assert!((frame.level - 0.25).abs() < 0.01, "level {}", frame.level);
        }
    }

    #[test]
    fn keeps_only_what_it_needs() {
        let mut analyzer = Analyzer::new(RATE, 1.0);
        let mut frames = Vec::new();
        for _ in 0..1000 {
            analyzer.push(&[0.1; 480], &mut frames);
        }
        assert!(analyzer.buffer.len() < WINDOW * 3);
        assert_eq!(analyzer.total(), 480_000);
    }
}
