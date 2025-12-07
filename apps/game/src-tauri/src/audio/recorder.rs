use super::{device::DeviceManager, input::InputStreamManager, output::OutputMixer, types::MicrophoneOptions};
use crate::error::AppError;
use cpal::Stream;
use std::{
    collections::HashMap,
    sync::{mpsc, Arc},
    thread,
};
use tauri::AppHandle;

/// Manages audio recording and playback
pub struct Recorder {
    stop_tx: mpsc::Sender<()>,
    thread_handle: Option<thread::JoinHandle<Result<(), AppError>>>,
}

impl Recorder {
    /// Create a new recorder and start the recording loop
    pub fn new(
        app_handle: AppHandle,
        options: Vec<MicrophoneOptions>,
        samples_per_beat: usize,
        playback_enabled: bool,
        playback_volume: f32,
    ) -> Result<Self, AppError> {
        let (stop_tx, stop_rx) = mpsc::channel();

        let thread_handle = thread::spawn(move || {
            Self::run_recording_loop(
                app_handle,
                options,
                stop_rx,
                samples_per_beat,
                playback_enabled,
                playback_volume,
            )
        });

        Ok(Self {
            stop_tx,
            thread_handle: Some(thread_handle),
        })
    }

    /// Main recording loop that sets up and manages all audio streams
    fn run_recording_loop(
        app_handle: AppHandle,
        options: Vec<MicrophoneOptions>,
        stop_rx: mpsc::Receiver<()>,
        samples_per_beat: usize,
        playback_enabled: bool,
        playback_volume: f32,
    ) -> Result<(), AppError> {
        let device_manager = DeviceManager::new()?;
        let mic_names: Vec<String> = options.iter().map(|opt| opt.name.clone()).collect();
        let input_devices = device_manager.find_input_devices(&mic_names)?;

        let input_sample_rates: Vec<u32> = if playback_enabled {
            let mut rates = vec![0u32; options.len()];
            for (_, config, mic_indices) in &input_devices {
                let sample_rate = config.sample_rate.0;
                for &index in mic_indices {
                    if index < rates.len() {
                        rates[index] = sample_rate;
                    }
                }
            }
            rates
        } else {
            Vec::new()
        };

        let output_mixer: Option<OutputMixer> = if playback_enabled {
            let (_, output_config) = device_manager.get_output_config()?;
            let output_sample_rate = output_config.sample_rate.0;
            let mixer = OutputMixer::new(options.len(), &input_sample_rates, output_sample_rate)?;
            Some(mixer)
        } else {
            None
        };

        let output_producers: HashMap<usize, _> = if let Some(mixer) = &output_mixer {
            (0..options.len())
                .filter_map(|index| {
                    mixer.get_producer(index).map(|producer| (index, producer))
                })
                .collect()
        } else {
            HashMap::new()
        };

        let playback_enabled_atomic = if playback_enabled {
            Arc::new(std::sync::atomic::AtomicBool::new(true))
        } else {
            Arc::new(std::sync::atomic::AtomicBool::new(false))
        };

        let mut streams: Vec<Stream> = InputStreamManager::setup_input_streams(
            input_devices,
            &options,
            samples_per_beat,
            app_handle,
            &output_producers,
            playback_enabled_atomic,
        )?;

        if let Some(mixer) = output_mixer {
            let (output_device, output_config) = device_manager.get_output_config()?;
            let output_stream = mixer.create_output_stream(output_device, output_config, playback_volume)?;
            streams.push(output_stream);
        }

        stop_rx.recv().map_err(|_| AppError::RecorderError("Stop channel closed".to_string()))?;

        Ok(())
    }
}

impl Drop for Recorder {
    fn drop(&mut self) {
        let _ = self.stop_tx.send(());
        if let Some(handle) = self.thread_handle.take() {
            let _ = handle.join();
        }
    }
}
