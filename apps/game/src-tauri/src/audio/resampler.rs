use crate::error::AppError;
use ringbuf::traits::Consumer;
use ringbuf::HeapCons;
use rubato::audioadapter_buffers::direct::InterleavedSlice;
use rubato::{Async, FixedAsync, Indexing, Resampler, SincInterpolationParameters, WindowFunction};

/// Input frames per `process` call. The resampler is created in `FixedAsync::Input`
/// mode, so it consumes exactly this many frames each call. Partial reads are
/// buffered in `pending_input` until a chunk is ready.
const RESAMPLER_CHUNK: usize = 1024;

/// Single-channel (mono) resampling: every buffer is one channel of interleaved
/// data, which for one channel is just a flat slice.
const CHANNELS: usize = 1;

pub struct AudioResampler {
    resampler: Async<f32>,
    pending_input: Vec<f32>,
    output_buffer: Vec<f32>,
    /// Resampled samples produced but not yet copied into the mix.
    output_leftover: Vec<f32>,
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

        let resampler = Async::<f32>::new_sinc(
            output_rate as f64 / input_rate as f64,
            2.0,
            &params,
            RESAMPLER_CHUNK,
            CHANNELS,
            FixedAsync::Input,
        )
        .map_err(|e| AppError::CpalError(format!("Failed to create resampler: {}", e)))?;

        let output_capacity = resampler.output_frames_max();

        Ok(Some(Self {
            resampler,
            pending_input: Vec::with_capacity(RESAMPLER_CHUNK * 2),
            output_buffer: vec![0.0f32; output_capacity],
            output_leftover: Vec::with_capacity(output_capacity * 2),
        }))
    }

    /// Drain `consumer`, resample, and write up to `frame_size` samples into
    /// `out` (zero-filling the remainder). Partial input/output is buffered
    /// across calls so no audio is dropped and the steady state never allocates.
    pub fn resample_into(
        &mut self,
        consumer: &mut HeapCons<f32>,
        frame_size: usize,
        out: &mut [f32],
    ) {
        let mut tmp = [0.0f32; RESAMPLER_CHUNK];
        loop {
            let n = consumer.pop_slice(&mut tmp);
            if n == 0 {
                break;
            }
            self.pending_input.extend_from_slice(&tmp[..n]);
        }

        while self.pending_input.len() >= RESAMPLER_CHUNK {
            let input = match InterleavedSlice::new(
                &self.pending_input[..RESAMPLER_CHUNK],
                CHANNELS,
                RESAMPLER_CHUNK,
            ) {
                Ok(input) => input,
                Err(_) => {
                    self.pending_input.drain(..RESAMPLER_CHUNK);
                    continue;
                }
            };

            let output_frames = self.output_buffer.len();
            let mut output = match InterleavedSlice::new_mut(
                &mut self.output_buffer[..],
                CHANNELS,
                output_frames,
            ) {
                Ok(output) => output,
                Err(_) => {
                    self.pending_input.drain(..RESAMPLER_CHUNK);
                    continue;
                }
            };

            let indexing = Indexing {
                input_offset: 0,
                output_offset: 0,
                active_channels_mask: None,
                partial_len: None,
            };

            match self
                .resampler
                .process_into_buffer(&input, &mut output, Some(&indexing))
            {
                Ok((input_used, output_written)) => {
                    self.output_leftover
                        .extend_from_slice(&self.output_buffer[..output_written]);
                    // Always advance by a full chunk to guarantee forward progress.
                    let drained = input_used
                        .max(RESAMPLER_CHUNK)
                        .min(self.pending_input.len());
                    self.pending_input.drain(..drained);
                }
                Err(_) => {
                    self.pending_input.drain(..RESAMPLER_CHUNK);
                }
            }
        }

        let out = &mut out[..frame_size];
        let count = self.output_leftover.len().min(frame_size);
        out[..count].copy_from_slice(&self.output_leftover[..count]);
        out[count..].fill(0.0);
        self.output_leftover.drain(..count);
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
