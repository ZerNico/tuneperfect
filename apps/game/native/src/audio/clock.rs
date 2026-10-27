//! One monotonic clock for the audio side, so frame times and batch send times compare.

use std::sync::LazyLock;
use std::time::Instant;

static START: LazyLock<Instant> = LazyLock::new(Instant::now);

/// Nanoseconds since the clock's first use in this process.
pub fn now_ns() -> u64 {
    START.elapsed().as_nanos() as u64
}

pub fn ns_to_ms(ns: u64) -> f64 {
    ns as f64 / 1_000_000.0
}

/// How fast the estimate may move later, in ns per ns: 0.1 ms a second, enough to follow the
/// sound card's clock drifting against the system's.
const RELAX: f64 = 1e-4;

/// When each sample of a stream was captured, from the times its samples arrived.
///
/// Samples come in callbacks of a few milliseconds, and how long one waits before it's handled
/// varies, so timing each sample by its own callback would jitter. Samples are evenly spaced
/// though: the earliest arrival seen tells when sample 0 was captured (the least delayed
/// callback), and every later sample is a sample period after it.
#[derive(Debug, Default)]
pub struct SampleClock {
    /// Estimated capture time of sample 0, in ns on the [`now_ns`] clock.
    origin: Option<f64>,
    last_arrival_ns: u64,
}

impl SampleClock {
    /// The first `total` samples had all arrived by `arrival_ns`.
    pub fn observe(&mut self, arrival_ns: u64, total: u64, sample_rate: u32) {
        let candidate = arrival_ns as f64 - total as f64 * 1e9 / f64::from(sample_rate);
        self.origin = Some(match self.origin {
            None => candidate,
            Some(origin) => {
                let elapsed = arrival_ns.saturating_sub(self.last_arrival_ns) as f64;
                candidate.min(origin + elapsed * RELAX)
            }
        });
        self.last_arrival_ns = arrival_ns;
    }

    /// When `sample` was captured, in ns on the [`now_ns`] clock.
    pub fn time_of(&self, sample: u64, sample_rate: u32) -> u64 {
        let origin = self.origin.unwrap_or(0.0);
        (origin + sample as f64 * 1e9 / f64::from(sample_rate)).max(0.0) as u64
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const RATE: u32 = 48_000;

    #[test]
    fn evenly_spaced_samples_get_evenly_spaced_times_despite_jittery_arrivals() {
        let mut clock = SampleClock::default();
        // Callbacks of 256 samples, each arriving 1 to 6 ms after its last sample was captured.
        let start_ns = 1_000_000_000u64;
        for callback in 1..=400u64 {
            let total = callback * 256;
            let captured_ns = start_ns + total * 1_000_000_000 / u64::from(RATE);
            let delay_ns = 1_000_000 + (callback * 7_919 % 5) * 1_000_000;
            clock.observe(captured_ns + delay_ns, total, RATE);
        }

        // Spaced exactly a hop apart, and within the least delay (1 ms) of the truth.
        let hop = u64::from(RATE / 100);
        let a = clock.time_of(100 * hop, RATE);
        let b = clock.time_of(101 * hop, RATE);
        assert!((b - a).abs_diff(10_000_000) <= 1);
        let truth = start_ns + 100 * hop * 1_000_000_000 / u64::from(RATE);
        assert!(a.abs_diff(truth) <= 1_000_001, "{} vs {}", a, truth);
    }

    #[test]
    fn follows_a_slowly_drifting_clock() {
        let mut clock = SampleClock::default();
        // The sound card runs 50 ppm slow: arrivals fall behind the sample count over time.
        for callback in 1..=60_000u64 {
            let total = callback * 480;
            let ideal_ns = total * 1_000_000_000 / u64::from(RATE);
            let arrival_ns = ideal_ns + ideal_ns / 20_000 + 2_000_000;
            clock.observe(arrival_ns, total, RATE);
        }
        // After ten minutes the drift is 30 ms; the estimate keeps within a couple of ms of it.
        let total = 60_000u64 * 480;
        let ideal_ns = total * 1_000_000_000 / u64::from(RATE);
        let captured_ns = ideal_ns + ideal_ns / 20_000;
        assert!(clock.time_of(total, RATE).abs_diff(captured_ns) < 3_000_000);
    }
}
