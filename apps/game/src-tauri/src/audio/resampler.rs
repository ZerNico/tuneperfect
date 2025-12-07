use crate::error::AppError;
use ringbuf::traits::Consumer;
use ringbuf::HeapCons;
use rubato::{Resampler, SincFixedIn, SincInterpolationParameters, WindowFunction};
use std::sync::{Arc, Mutex};

use super::types::DEFAULT_BUFFER_SIZE;

pub struct AudioResampler {
    resampler: Option<Arc<Mutex<SincFixedIn<f32>>>>,
}

impl AudioResampler {
    pub fn new(input_rate: u32, output_rate: u32) -> Result<Option<Self>, AppError> {
        if input_rate == output_rate {
            return Ok(None);
        }

        let params = SincInterpolationParameters {
            sinc_len: 256,
            f_cutoff: 0.95,
            window: WindowFunction::BlackmanHarris2,
            oversampling_factor: 256,
            interpolation: rubato::SincInterpolationType::Linear,
        };

        let resampler = SincFixedIn::<f32>::new(
            output_rate as f64 / input_rate as f64,
            2.0,
            params,
            1024,
            1,
        )
        .map_err(|e| AppError::CpalError(format!("Failed to create resampler: {}", e)))?;

        Ok(Some(Self {
            resampler: Some(Arc::new(Mutex::new(resampler))),
        }))
    }

    pub fn resample(
        &self,
        consumer: &Arc<Mutex<HeapCons<f32>>>,
        frame_size: usize,
    ) -> Vec<f32> {
        let mut mic_buffer = vec![0.0f32; DEFAULT_BUFFER_SIZE];
        let samples_read = if let Ok(mut c) = consumer.lock() {
            c.pop_slice(&mut mic_buffer)
        } else {
            0
        };

        if samples_read == 0 {
            return vec![0.0f32; frame_size];
        }

        let mic_buffer = &mic_buffer[..samples_read];

        if let Some(resampler) = &self.resampler {
            if let Ok(mut r) = resampler.lock() {
                let input = vec![mic_buffer.to_vec()];
                match r.process(&input, None) {
                    Ok(output) => {
                        if let Some(channel) = output.first() {
                            let mut resampled = channel.clone();
                            if resampled.len() < frame_size {
                                resampled.resize(frame_size, 0.0);
                            } else if resampled.len() > frame_size {
                                resampled.truncate(frame_size);
                            }
                            resampled
                        } else {
                            vec![0.0f32; frame_size]
                        }
                    }
                    Err(_) => {
                        let mut buffer = mic_buffer.to_vec();
                        if buffer.len() < frame_size {
                            buffer.resize(frame_size, 0.0);
                        } else if buffer.len() > frame_size {
                            buffer.truncate(frame_size);
                        }
                        buffer
                    }
                }
            } else {
                let mut buffer = mic_buffer.to_vec();
                if buffer.len() < frame_size {
                    buffer.resize(frame_size, 0.0);
                } else if buffer.len() > frame_size {
                    buffer.truncate(frame_size);
                }
                buffer
            }
        } else {
            let mut buffer = mic_buffer.to_vec();
            if buffer.len() < frame_size {
                buffer.resize(frame_size, 0.0);
            } else if buffer.len() > frame_size {
                buffer.truncate(frame_size);
            }
            buffer
        }
    }
}

pub fn create_resamplers(
    input_sample_rates: &[u32],
    output_sample_rate: u32,
) -> Result<Vec<Option<AudioResampler>>, AppError> {
    input_sample_rates
        .iter()
        .map(|&input_rate| AudioResampler::new(input_rate, output_sample_rate))
        .collect()
}
