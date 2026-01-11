use crate::error::AppError;
use cpal::traits::{DeviceTrait, HostTrait};
use serde::Serialize;

#[derive(Debug, Serialize, specta::Type)]
pub struct Microphone {
    name: String,
    channels: u16,
}

#[tauri::command]
#[specta::specta]
pub fn get_microphones() -> Result<Vec<Microphone>, AppError> {
    let mut microphones = Vec::new();

    let host = cpal::default_host();
    for device in host.input_devices().unwrap() {
        if let Ok(config) = device.default_input_config() {
            if let Ok(description) = device.description() {
                microphones.push(Microphone {
                    name: description.name().to_string(),
                    channels: config.channels(),
                });
            }
        }
    }

    Ok(microphones)
}
