use super::{processor::Processor, types::MicrophoneOptions};
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
        samples_per_beat: usize,
        app_handle: AppHandle,
        output_producers: &HashMap<usize, Arc<Mutex<HeapProd<f32>>>>,
        playback_enabled: Arc<AtomicBool>,
    ) -> Result<Vec<Stream>, AppError> {
        let mut streams = Vec::new();
        let playback_enabled_clone = playback_enabled.clone();

        for (device, config, mic_indices) in devices {
            let channels = config.channels as usize;
            let sample_rate = config.sample_rate;

            let processors: HashMap<_, _> = mic_indices
                .iter()
                .map(|&index| {
                    let mic_option = &options[index];
                    let processor = Processor::new(mic_option.clone(), sample_rate, samples_per_beat);
                    (index, Arc::new(Mutex::new(processor)))
                })
                .collect();

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

            let device_output_producers: HashMap<usize, Arc<Mutex<HeapProd<f32>>>> = mic_indices
                .iter()
                .filter_map(|&index| {
                    output_producers.get(&index).map(|producer| (index, producer.clone()))
                })
                .collect();

            let input_callback = Self::create_input_callback(
                mic_indices,
                options,
                channels,
                processors,
                device_output_producers,
                playback_enabled_clone.clone(),
            );

            let stream = device.build_input_stream(
                &config,
                input_callback,
                |err| eprintln!("Input stream error: {}", err),
                None,
            )?;

            stream.play()?;
            streams.push(stream);
        }

        Ok(streams)
    }

    /// Create the input data callback function
    fn create_input_callback(
        mic_indices: Vec<usize>,
        options: &[MicrophoneOptions],
        channels: usize,
        processors: HashMap<usize, Arc<Mutex<Processor>>>,
        device_output_producers: HashMap<usize, Arc<Mutex<HeapProd<f32>>>>,
        playback_enabled: Arc<AtomicBool>,
    ) -> impl FnMut(&[f32], &cpal::InputCallbackInfo) + Send + 'static {
        let options_map: HashMap<usize, MicrophoneOptions> = mic_indices
            .iter()
            .map(|&index| (index, options[index].clone()))
            .collect();

        move |data: &[f32], _: &cpal::InputCallbackInfo| {
            for (&index, option) in &options_map {
                let buffer: Vec<f32> = data
                    .iter()
                    .skip(option.channel as usize)
                    .step_by(channels)
                    .copied()
                    .collect();

                if let Some(processor) = processors.get(&index) {
                    match processor.lock() {
                        Ok(mut p) => {
                            p.push_audio_data(&buffer);
                        }
                        Err(poisoned) => {
                            let mut p = poisoned.into_inner();
                            p.push_audio_data(&buffer);
                        }
                    }
                }

                if playback_enabled.load(Ordering::Relaxed) {
                    if let Some(producer) = device_output_producers.get(&index) {
                        let gained: Vec<f32> = buffer
                            .iter()
                            .map(|&s| (s * option.gain).clamp(-1.0, 1.0))
                            .collect();

                        if let Ok(mut p) = producer.lock() {
                            let _ = p.push_slice(&gained);
                        }
                    }
                }
            }
        }
    }
}
