use super::{
    device::DeviceManager, input::InputStreamManager, output::OutputMixer, types::MicrophoneOptions,
};
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
        playback_enabled: bool,
        playback_volume: f32,
    ) -> Result<Self, AppError> {
        let (stop_tx, stop_rx) = mpsc::channel();

        let thread_handle = thread::spawn(move || {
            Self::run_recording_loop(
                app_handle,
                options,
                stop_rx,
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
        playback_enabled: bool,
        playback_volume: f32,
    ) -> Result<(), AppError> {
        let device_manager = DeviceManager::new()?;
        let input_devices = device_manager.find_input_devices(&options)?;

        let input_sample_rates: Vec<u32> = if playback_enabled {
            let mut rates = vec![0u32; options.len()];
            for (_, config, mic_indices) in &input_devices {
                let sample_rate = config.sample_rate;
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

        // Resolve the output config once (and reuse it for both the mixer and the
        // output stream) so the mixer's resampler targets the exact rate the
        // output stream runs at. Prefer matching the input rate to skip resampling.
        let desired_output_rate = input_sample_rates.iter().copied().find(|&rate| rate != 0);
        let output_config = if playback_enabled {
            Some(device_manager.get_output_config(desired_output_rate)?)
        } else {
            None
        };

        let mut output_mixer: Option<OutputMixer> = if let Some((_, config)) = &output_config {
            let mixer = OutputMixer::new(options.len(), &input_sample_rates, config.sample_rate)?;
            Some(mixer)
        } else {
            None
        };

        // Move each producer out of the mixer to the input side. The matching
        // consumer stays in the mixer and is read by the output callback.
        let output_producers: HashMap<usize, _> = if let Some(mixer) = &mut output_mixer {
            (0..options.len())
                .filter_map(|index| mixer.take_producer(index).map(|producer| (index, producer)))
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
            app_handle,
            output_producers,
            playback_enabled_atomic,
        )?;

        if let (Some(mixer), Some((output_device, output_config))) = (output_mixer, output_config) {
            let output_stream =
                mixer.create_output_stream(output_device, output_config, playback_volume)?;
            streams.push(output_stream);
        }

        stop_rx
            .recv()
            .map_err(|_| AppError::RecorderError("Stop channel closed".to_string()))?;

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
