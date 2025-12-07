use crate::error::AppError;
use cpal::traits::{DeviceTrait, StreamTrait};
use cpal::{Device, Stream, StreamConfig};
use ringbuf::traits::{Consumer, Split};
use ringbuf::{HeapCons, HeapProd, HeapRb};
use std::sync::{Arc, Mutex};

use super::{resampler::AudioResampler, types::DEFAULT_BUFFER_SIZE};

/// Manages audio output mixing and playback
pub struct OutputMixer {
    mic_producers: Vec<Arc<Mutex<HeapProd<f32>>>>,
    mic_consumers: Vec<Arc<Mutex<HeapCons<f32>>>>,
    resamplers: Vec<Option<Arc<AudioResampler>>>,
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
            mic_producers.push(Arc::new(Mutex::new(producer)));
            mic_consumers.push(Arc::new(Mutex::new(consumer)));
        }

        let resamplers: Vec<Option<Arc<AudioResampler>>> = super::resampler::create_resamplers(input_sample_rates, output_sample_rate)?
            .into_iter()
            .map(|opt| opt.map(Arc::new))
            .collect();

        Ok(Self {
            mic_producers,
            mic_consumers,
            resamplers,
        })
    }

    /// Get a producer for a specific microphone index
    pub fn get_producer(&self, mic_index: usize) -> Option<Arc<Mutex<HeapProd<f32>>>> {
        self.mic_producers.get(mic_index).cloned()
    }

    /// Create and start the output stream
    pub fn create_output_stream(
        &self,
        device: Device,
        config: StreamConfig,
        playback_volume: f32,
    ) -> Result<Stream, AppError> {
        let output_channels = config.channels as usize;
        let mic_consumers = self.mic_consumers.clone();
        let resamplers = self.resamplers.clone();
        let volume = playback_volume.clamp(0.0, 1.0);

        let output_callback = move |data: &mut [f32], _: &cpal::OutputCallbackInfo| {
            let frame_size = data.len() / output_channels;

            let mixed = Self::mix_audio(&mic_consumers, &resamplers, frame_size);
            let clamped: Vec<f32> = mixed
                .iter()
                .map(|&sample| sample.clamp(-1.0, 1.0))
                .collect();

            for (i, &mono_sample) in clamped.iter().enumerate() {
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

    fn mix_audio(
        consumers: &[Arc<Mutex<HeapCons<f32>>>],
        resamplers: &[Option<Arc<AudioResampler>>],
        frame_size: usize,
    ) -> Vec<f32> {
        let mut mixed = vec![0.0f32; frame_size];

        for (idx, consumer) in consumers.iter().enumerate() {
            let resampled = if let Some(resampler) = resamplers.get(idx).and_then(|r| r.as_ref()) {
                resampler.resample(consumer, frame_size)
            } else if let Ok(mut c) = consumer.lock() {
                let mut buffer = vec![0.0f32; frame_size];
                let samples_read = c.pop_slice(&mut buffer);
                if samples_read < frame_size {
                    buffer[samples_read..].fill(0.0);
                }
                buffer
            } else {
                continue;
            };

            for (mixed_sample, mic_sample) in mixed.iter_mut().zip(resampled.iter()) {
                *mixed_sample += mic_sample;
            }
        }

        mixed
    }
}
