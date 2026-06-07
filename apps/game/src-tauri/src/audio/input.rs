use super::{
    processor::{AudioInput, Processor},
    types::MicrophoneOptions,
};
use crate::{error::AppError, AppState};
use cpal::traits::{DeviceTrait, StreamTrait};
use cpal::{Device, Stream, StreamConfig};
use ringbuf::{traits::Producer, HeapProd};
use std::{
    collections::HashMap,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc, Mutex,
    },
};
use tauri::{AppHandle, Manager};

/// Manages input stream setup and audio routing
pub struct InputStreamManager;

impl InputStreamManager {
    /// Set up input streams for the given devices and microphone options
    pub fn setup_input_streams(
        devices: Vec<(Device, StreamConfig, Vec<usize>)>,
        options: &[MicrophoneOptions],
        app_handle: AppHandle,
        mut output_producers: HashMap<usize, HeapProd<f32>>,
        playback_enabled: Arc<AtomicBool>,
    ) -> Result<Vec<Stream>, AppError> {
        let mut streams = Vec::new();
        let playback_enabled_clone = playback_enabled.clone();

        for (device, config, mic_indices) in devices {
            let channels = config.channels as usize;
            let sample_rate = config.sample_rate;

            // Each mic gets a processor (reader side, behind the lock) and a
            // paired lock-free audio input (written by the callback).
            let mut processors: HashMap<usize, Arc<Mutex<Processor>>> = HashMap::new();
            let mut inputs: HashMap<usize, AudioInput> = HashMap::new();
            for &index in &mic_indices {
                let mic_option = options[index].clone();
                let (processor, input) = Processor::new(mic_option, sample_rate);
                processors.insert(index, Arc::new(Mutex::new(processor)));
                inputs.insert(index, input);
            }

            let state = app_handle.state::<AppState>();
            match state.processors.write() {
                Ok(mut processors_state) => {
                    processors_state.extend(processors.clone());
                }
                Err(poisoned) => {
                    let mut processors_state = poisoned.into_inner();
                    processors_state.extend(processors.clone());
                }
            }

            // Move (not clone) each producer to the single input callback that
            // writes to it; the ring buffer is lock-free SPSC.
            let device_output_producers: HashMap<usize, HeapProd<f32>> = mic_indices
                .iter()
                .filter_map(|&index| {
                    output_producers
                        .remove(&index)
                        .map(|producer| (index, producer))
                })
                .collect();

            let input_callback = Self::create_input_callback(
                mic_indices,
                options,
                channels,
                inputs,
                device_output_producers,
                playback_enabled_clone.clone(),
            );

            let stream = device.build_input_stream(
                config,
                input_callback,
                |err| eprintln!("Input stream error: {}", err),
                None,
            )?;

            stream.play()?;
            streams.push(stream);
        }

        Ok(streams)
    }

    /// The callback only writes to the lock-free [`AudioInput`] (and playback)
    /// producers; it never locks the processors, so the audio thread is never
    /// blocked by pitch computation.
    fn create_input_callback(
        mic_indices: Vec<usize>,
        options: &[MicrophoneOptions],
        channels: usize,
        mut inputs: HashMap<usize, AudioInput>,
        mut device_output_producers: HashMap<usize, HeapProd<f32>>,
        playback_enabled: Arc<AtomicBool>,
    ) -> impl FnMut(&[f32], &cpal::InputCallbackInfo) + Send + 'static {
        let options_map: HashMap<usize, MicrophoneOptions> = mic_indices
            .iter()
            .map(|&index| (index, options[index].clone()))
            .collect();

        // Reusable scratch buffers so the realtime input callback never allocates.
        let mut channel_buffer: Vec<f32> = Vec::with_capacity(super::types::DEFAULT_BUFFER_SIZE);
        let mut gained_buffer: Vec<f32> = Vec::with_capacity(super::types::DEFAULT_BUFFER_SIZE);

        move |data: &[f32], _: &cpal::InputCallbackInfo| {
            for (&index, option) in &options_map {
                channel_buffer.clear();
                channel_buffer.extend(
                    data.iter()
                        .skip(option.channel as usize)
                        .step_by(channels)
                        .copied(),
                );

                if let Some(input) = inputs.get_mut(&index) {
                    input.push_audio_data(&channel_buffer);
                }

                if playback_enabled.load(Ordering::Relaxed) {
                    if let Some(producer) = device_output_producers.get_mut(&index) {
                        gained_buffer.clear();
                        gained_buffer.extend(
                            channel_buffer
                                .iter()
                                .map(|&s| (s * option.gain).clamp(-1.0, 1.0)),
                        );
                        let _ = producer.push_slice(&gained_buffer);
                    }
                }
            }
        }
    }
}
