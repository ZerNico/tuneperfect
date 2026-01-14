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
    let devices = host.devices().unwrap();
    for (_, device) in devices.enumerate() {
        if let Ok(config) = device.default_input_config() {
            let microphone = Microphone {
                name: device.name().unwrap(),
                channels: config.channels(),
            };
            microphones.push(microphone);
        }
    }

    Ok(microphones)
}
