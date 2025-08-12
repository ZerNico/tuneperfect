use super::processor::Processor;
use crate::{error::AppError, AppState};
use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    sync::{mpsc, Arc, Mutex},
    thread,
};
use tauri::{AppHandle, Manager};

#[derive(Debug, Serialize, Deserialize, specta::Type, Clone)]
pub struct MicrophoneOptions {
    pub name: String,
    pub channel: i32,
    pub gain: f32,
    pub threshold: f32,
}

pub struct Recorder {
    stop_tx: mpsc::Sender<()>,
    thread_handle: Option<thread::JoinHandle<Result<(), AppError>>>,
}

impl Recorder {
    pub fn new(
        app_handle: AppHandle,
        options: Vec<MicrophoneOptions>,
        samples_per_beat: usize,
    ) -> Result<Self, AppError> {
        let (stop_tx, stop_rx) = mpsc::channel();

        let thread_handle = thread::spawn(move || {
            Self::run_recording_loop(app_handle, options, stop_rx, samples_per_beat)
        });

        Ok(Self {
            stop_tx,
            thread_handle: Some(thread_handle),
        })
    }

    fn run_recording_loop(
        app_handle: AppHandle,
        options: Vec<MicrophoneOptions>,
        stop_rx: mpsc::Receiver<()>,
        samples_per_beat: usize,
    ) -> Result<(), AppError> {
        let host = cpal::default_host();
        let devices = host.devices()?;
        let mut streams = Vec::new();

        for device in devices {
            let device_name = device.name()?;
            let options_for_device: HashMap<_, _> = options
                .clone()
                .into_iter()
                .enumerate()
                .filter(|(_, mic)| mic.name == device_name)
                .collect();

            if options_for_device.is_empty() {
                continue;
            }

            if let Ok(config) = device.default_input_config() {
                let channels = config.channels() as usize;

                let processors: HashMap<_, _> = options_for_device
                    .clone()
                    .into_iter()
                    .map(|(index, o)| {
                        let sample_rate = config.sample_rate().0;
                        let processor = Processor::new(o.clone(), sample_rate, samples_per_beat);
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

                let input_data_fn = move |data: &[f32], _: &cpal::InputCallbackInfo| {
                    for (&index, option) in &options_for_device {
                        let buffer: Vec<f32> = data
                            .iter()
                            .skip(option.channel as usize)
                            .step_by(channels)
                            .copied()
                            .collect();

                        if let Some(processor) = processors.get(&index) {
                            match processor.lock() {
                                Ok(mut processor) => {
                                    processor.push_audio_data(&buffer);
                                }
                                Err(poisoned) => {
                                    let mut processor = poisoned.into_inner();
                                    processor.push_audio_data(&buffer);
                                }
                            }
                        }
                    }
                };

                let stream = device.build_input_stream(
                    &config.into(),
                    input_data_fn,
                    |err| eprintln!("Stream error: {}", err),
                    None,
                )?;

                stream.play()?;
                streams.push(stream);
            }
        }

        stop_rx.recv().unwrap();

        Ok(())
    }
}

impl Drop for Recorder {
    fn drop(&mut self) {
        self.stop_tx.send(()).unwrap();
        self.thread_handle.take().unwrap().join().unwrap().unwrap();
    }
}
