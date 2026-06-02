use crate::error::AppError;
use cpal::traits::{DeviceTrait, StreamTrait};
use cpal::{Device, Stream, StreamConfig};
use ringbuf::traits::{Consumer, Observer, Split};
use ringbuf::{HeapCons, HeapProd, HeapRb};

use super::{resampler::AudioResampler, types::DEFAULT_BUFFER_SIZE};

/// Max backlog kept per mic, as a multiple of the callback frame size. Caps
/// latency creep if input drifts faster than output.
const MAX_BACKLOG_FRAMES: usize = 2;

/// Drop the oldest samples once the consumer exceeds the backlog cap.
fn drop_backlog(consumer: &mut HeapCons<f32>, frame_size: usize) {
    let max_backlog = frame_size.saturating_mul(MAX_BACKLOG_FRAMES);
    let occupied = consumer.occupied_len();
    if occupied > max_backlog {
        consumer.skip(occupied - max_backlog);
    }
}

/// One-pole DC-blocking high-pass (`y[n] = x[n] - x[n-1] + R*y[n-1]`) to remove
/// mic DC bias before mixing.
struct DcBlocker {
    prev_input: f32,
    prev_output: f32,
}

impl DcBlocker {
    /// ~20–40 Hz corner at 44.1/48 kHz, below the singing range.
    const R: f32 = 0.995;

    fn new() -> Self {
        Self {
            prev_input: 0.0,
            prev_output: 0.0,
        }
    }

    #[inline]
    fn process(&mut self, input: f32) -> f32 {
        let output = input - self.prev_input + Self::R * self.prev_output;
        self.prev_input = input;
        self.prev_output = output;
        output
    }
}

/// Manages audio output mixing and playback
pub struct OutputMixer {
    /// Producers are taken (moved) by the input callbacks. Each ring buffer is a
    /// lock-free SPSC channel with exactly one writer (input callback) and one
    /// reader (output callback), so no Mutex is needed.
    mic_producers: Vec<Option<HeapProd<f32>>>,
    mic_consumers: Vec<HeapCons<f32>>,
    resamplers: Vec<Option<AudioResampler>>,
    dc_blockers: Vec<DcBlocker>,
}

impl OutputMixer {
    pub fn new(
        num_mics: usize,
        input_sample_rates: &[u32],
        output_sample_rate: u32,
    ) -> Result<Self, AppError> {
        let mut mic_producers = Vec::new();
        let mut mic_consumers = Vec::new();

        for _ in 0..num_mics {
            let buffer = HeapRb::<f32>::new(DEFAULT_BUFFER_SIZE);
            let (producer, consumer) = buffer.split();
            mic_producers.push(Some(producer));
            mic_consumers.push(consumer);
        }

        let resamplers: Vec<Option<AudioResampler>> =
            super::resampler::create_resamplers(input_sample_rates, output_sample_rate)?;

        let dc_blockers = (0..num_mics).map(|_| DcBlocker::new()).collect();

        Ok(Self {
            mic_producers,
            mic_consumers,
            resamplers,
            dc_blockers,
        })
    }

    /// Take ownership of the producer for a specific microphone index. The
    /// producer is moved to the (single) input callback that writes to it.
    pub fn take_producer(&mut self, mic_index: usize) -> Option<HeapProd<f32>> {
        self.mic_producers.get_mut(mic_index).and_then(Option::take)
    }

    /// Create and start the output stream. Consumes the mixer because the
    /// consumers and resamplers are moved into the realtime callback.
    pub fn create_output_stream(
        self,
        device: Device,
        config: StreamConfig,
        playback_volume: f32,
    ) -> Result<Stream, AppError> {
        let output_channels = config.channels as usize;
        let mut mic_consumers = self.mic_consumers;
        let mut resamplers = self.resamplers;
        let mut dc_blockers = self.dc_blockers;
        let volume = playback_volume.clamp(0.0, 1.0);

        // Pre-allocated scratch buffers reused across callbacks so the realtime
        // audio thread never allocates on the hot path.
        let mut mixed: Vec<f32> = Vec::with_capacity(DEFAULT_BUFFER_SIZE);
        let mut scratch: Vec<f32> = vec![0.0f32; DEFAULT_BUFFER_SIZE];

        let output_callback = move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
            let frame_size = data.len() / output_channels;

            Self::mix_audio(
                &mut mic_consumers,
                &mut resamplers,
                &mut dc_blockers,
                frame_size,
                &mut mixed,
                &mut scratch,
            );

            for (i, &mono_sample) in mixed.iter().enumerate() {
                let sample = (mono_sample * volume).clamp(-1.0, 1.0);
                for ch in 0..output_channels {
                    if i * output_channels + ch < data.len() {
                        data[i * output_channels + ch] = sample;
                    }
                }
            }
        };

        let stream = device.build_output_stream(
            &config,
            output_callback,
            |err| eprintln!("Output stream error: {}", err),
            None,
        )?;

        stream.play()?;
        Ok(stream)
    }

    /// Mix all mic consumers into `mixed` (mono): render each into `scratch`,
    /// DC-block, then sum. `scratch` is reused so the realtime thread never allocates.
    fn mix_audio(
        consumers: &mut [HeapCons<f32>],
        resamplers: &mut [Option<AudioResampler>],
        dc_blockers: &mut [DcBlocker],
        frame_size: usize,
        mixed: &mut Vec<f32>,
        scratch: &mut [f32],
    ) {
        mixed.clear();
        mixed.resize(frame_size, 0.0);

        let mut active_mics = 0usize;

        for (idx, consumer) in consumers.iter_mut().enumerate() {
            drop_backlog(consumer, frame_size);

            let buffer = &mut scratch[..frame_size];

            if let Some(Some(resampler)) = resamplers.get_mut(idx).map(|r| r.as_mut()) {
                resampler.resample_into(consumer, frame_size, buffer);
            } else {
                let samples_read = consumer.pop_slice(buffer);
                if samples_read < frame_size {
                    buffer[samples_read..].fill(0.0);
                }
            }

            if let Some(blocker) = dc_blockers.get_mut(idx) {
                for sample in buffer.iter_mut() {
                    *sample = blocker.process(*sample);
                }
            }

            let mut mic_has_signal = false;
            for (mixed_sample, &mic_sample) in mixed.iter_mut().zip(buffer.iter()) {
                *mixed_sample += mic_sample;
                if mic_sample != 0.0 {
                    mic_has_signal = true;
                }
            }
            if mic_has_signal {
                active_mics += 1;
            }
        }

        // 1/sqrt(n) headroom so multiple singers don't sum into the hard clamp.
        if active_mics > 1 {
            let headroom = 1.0 / (active_mics as f32).sqrt();
            for sample in mixed.iter_mut() {
                *sample *= headroom;
            }
        }

        for sample in mixed.iter_mut() {
            *sample = sample.clamp(-1.0, 1.0);
        }
    }
}
