//! Drains every microphone regularly and streams the analysed frames to subscribers.

use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};
use std::sync::{Arc, Mutex, RwLock};
use std::thread;
use std::time::Duration;

use super::clock::{now_ns, ns_to_ms};
use super::processor::{Processor, TimedFrame};
use crate::state::ProcessorMap;

/// How often the worker drains the queues. A queue holds well over 100 ms, so nothing is lost.
const DRAIN_INTERVAL: Duration = Duration::from_millis(10);
/// How often frames are sent on: about a display frame, and few enough batches for the
/// main process to forward without effort.
const SEND_INTERVAL_NS: u64 = 18_000_000;

/// Receives encoded batches (see [`encode_batch`]).
pub type PitchSink = Arc<dyn Fn(Vec<f64>) + Send + Sync>;

/// Subscribers to the pitch stream. Lives in the app state rather than with a recording, so a
/// subscription carries over when the recording restarts.
#[derive(Default)]
pub struct PitchSinks {
    next_id: AtomicU32,
    sinks: RwLock<Vec<(u32, PitchSink)>>,
}

impl PitchSinks {
    pub fn subscribe(&self, sink: PitchSink) -> u32 {
        let id = self.next_id.fetch_add(1, Ordering::Relaxed);
        self.sinks
            .write()
            .unwrap_or_else(|e| e.into_inner())
            .push((id, sink));
        id
    }

    pub fn unsubscribe(&self, id: u32) {
        self.sinks
            .write()
            .unwrap_or_else(|e| e.into_inner())
            .retain(|(sink_id, _)| *sink_id != id);
    }

    pub fn is_empty(&self) -> bool {
        self.sinks
            .read()
            .unwrap_or_else(|e| e.into_inner())
            .is_empty()
    }

    fn send(&self, batch: &[f64]) {
        for (_, sink) in self.sinks.read().unwrap_or_else(|e| e.into_inner()).iter() {
            sink(batch.to_vec());
        }
    }
}

/// `[sentMs, count, (mic, timeMs, hz, level) × count]`, times on the audio clock
/// ([`super::clock::now_ns`]). Flat numbers so the batch crosses to JavaScript as one array.
pub fn encode_batch(sent_ns: u64, frames: &[(usize, TimedFrame)]) -> Vec<f64> {
    let mut batch = Vec::with_capacity(2 + frames.len() * 4);
    batch.push(ns_to_ms(sent_ns));
    batch.push(frames.len() as f64);
    for (mic, frame) in frames {
        batch.push(*mic as f64);
        batch.push(ns_to_ms(frame.time_ns));
        batch.push(f64::from(frame.hz));
        batch.push(f64::from(frame.level));
    }
    batch
}

/// Collects new frames from every processor, by mic index.
fn collect(processors: &ProcessorMap, out: &mut Vec<(usize, TimedFrame)>) {
    let mut by_index: Vec<(usize, Arc<Mutex<Processor>>)> = processors
        .read()
        .unwrap_or_else(|e| e.into_inner())
        .iter()
        .map(|(&index, processor)| (index, processor.clone()))
        .collect();
    by_index.sort_by_key(|(index, _)| *index);

    let mut frames = Vec::new();
    for (index, processor) in by_index {
        processor
            .lock()
            .unwrap_or_else(|e| e.into_inner())
            .take_frames(&mut frames);
        out.extend(frames.drain(..).map(|frame| (index, frame)));
    }
}

/// Runs for as long as a recording does; stops and joins when dropped.
pub struct AnalysisWorker {
    stop: Arc<AtomicBool>,
    handle: Option<thread::JoinHandle<()>>,
}

impl AnalysisWorker {
    pub fn start(processors: ProcessorMap, sinks: &'static PitchSinks) -> Self {
        let stop = Arc::new(AtomicBool::new(false));
        let stopped = stop.clone();

        let handle = thread::Builder::new()
            .name("pitch-analysis".into())
            .spawn(move || {
                let mut pending: Vec<(usize, TimedFrame)> = Vec::new();
                let mut last_send = now_ns();
                while !stopped.load(Ordering::Relaxed) {
                    thread::sleep(DRAIN_INTERVAL);
                    collect(&processors, &mut pending);

                    if sinks.is_empty() {
                        pending.clear();
                        continue;
                    }
                    let now = now_ns();
                    if !pending.is_empty() && now - last_send >= SEND_INTERVAL_NS {
                        sinks.send(&encode_batch(now, &pending));
                        pending.clear();
                        last_send = now;
                    }
                }
            })
            .expect("failed to spawn the pitch analysis thread");

        Self {
            stop,
            handle: Some(handle),
        }
    }
}

impl Drop for AnalysisWorker {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(handle) = self.handle.take() {
            let _ = handle.join();
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::audio::types::MicrophoneOptions;
    use std::collections::HashMap;
    use std::sync::mpsc;

    fn options() -> MicrophoneOptions {
        MicrophoneOptions {
            device_id: None,
            name: "Mic".into(),
            channel: 0,
            gain: 1.0,
            threshold: 1.0,
            delay: 0.0,
        }
    }

    #[test]
    fn encodes_batches_flat() {
        let frame = TimedFrame {
            time_ns: 2_500_000,
            hz: 440.0,
            level: 0.5,
        };
        assert_eq!(
            encode_batch(3_000_000, &[(1, frame)]),
            vec![3.0, 1.0, 1.0, 2.5, 440.0, 0.5]
        );
    }

    #[test]
    fn subscriptions_come_and_go() {
        let sinks = PitchSinks::default();
        let (tx, rx) = mpsc::channel();
        let tx = Mutex::new(tx);
        let id = sinks.subscribe(Arc::new(move |batch| {
            tx.lock().unwrap().send(batch).unwrap()
        }));

        sinks.send(&[1.0]);
        assert_eq!(rx.try_recv().unwrap(), vec![1.0]);

        sinks.unsubscribe(id);
        assert!(sinks.is_empty());
        sinks.send(&[2.0]);
        assert!(rx.try_recv().is_err());
    }

    #[test]
    fn streams_every_mic_and_nothing_is_lost_between_drains() {
        use std::sync::LazyLock;
        static SINKS: LazyLock<PitchSinks> = LazyLock::new(PitchSinks::default);

        let rate = 48_000;
        let mut map = HashMap::new();
        let mut inputs = Vec::new();
        // Mic 1 is missing (no device), like a gap in the configured mics.
        for index in [0usize, 2] {
            let (processor, input) = Processor::new(options(), rate);
            map.insert(index, Arc::new(Mutex::new(processor)));
            inputs.push(input);
        }
        let processors: ProcessorMap = Arc::new(RwLock::new(map));

        let (tx, rx) = mpsc::channel::<Vec<f64>>();
        let tx = Mutex::new(tx);
        SINKS.subscribe(Arc::new(move |batch| {
            let _ = tx.lock().unwrap().send(batch);
        }));
        let worker = AnalysisWorker::start(processors, &SINKS);

        // One second of a tone in bursts far larger than the queue holds between beats today.
        let tone: Vec<f32> = (0..rate as usize)
            .map(|i| (i as f32 * 220.0 * std::f32::consts::TAU / rate as f32).sin() * 0.5)
            .collect();
        for burst in tone.chunks(2400) {
            for input in &mut inputs {
                input.push_audio_data(burst);
            }
            thread::sleep(Duration::from_millis(50));
        }
        thread::sleep(Duration::from_millis(100));
        drop(worker);

        let mut per_mic: HashMap<usize, Vec<(f64, f64)>> = HashMap::new();
        for batch in rx.try_iter() {
            let count = batch[1] as usize;
            for i in 0..count {
                let at = 2 + i * 4;
                per_mic
                    .entry(batch[at] as usize)
                    .or_default()
                    .push((batch[at + 1], batch[at + 2]));
            }
        }

        let hop = rate as usize / 100;
        let expected = (rate as usize - 2400) / hop + 1;
        for mic in [0, 2] {
            let frames = &per_mic[&mic];
            assert_eq!(frames.len(), expected, "mic {mic}");
            assert!(frames.iter().all(|(_, hz)| (hz - 220.0).abs() < 2.0));
            assert!(
                frames.windows(2).all(|w| w[1].0 > w[0].0),
                "times go forward"
            );
            // Evenly spaced on the sample grid once the clock has settled, despite bursty arrival.
            let mut spacing: Vec<f64> = frames
                .windows(2)
                .skip(10)
                .map(|w| w[1].0 - w[0].0)
                .collect();
            spacing.sort_by(f64::total_cmp);
            let median = spacing[spacing.len() / 2];
            assert!((median - 10.0).abs() < 0.01, "median spacing {median}");
        }
    }
}
