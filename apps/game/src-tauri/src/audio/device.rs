use crate::error::AppError;
use cpal::traits::{DeviceTrait, HostTrait};
use cpal::{Device, StreamConfig};

/// Manages audio device enumeration and configuration
pub struct DeviceManager {
    host: cpal::Host,
}

impl DeviceManager {
    /// Create a new device manager
    pub fn new() -> Result<Self, AppError> {
        let host = cpal::default_host();
        Ok(Self { host })
    }

    /// Find all input devices that match the given microphone names
    pub fn find_input_devices(
        &self,
        mic_names: &[String],
    ) -> Result<Vec<(Device, StreamConfig, Vec<usize>)>, AppError> {
        let devices = self.host.devices()?;
        let mut found_devices = Vec::new();

        for device in devices {
            let device_name = device.name()?;
            let mic_indices: Vec<usize> = mic_names
                .iter()
                .enumerate()
                .filter(|(_, name)| name.as_str() == device_name.as_str())
                .map(|(idx, _)| idx)
                .collect();

            if mic_indices.is_empty() {
                continue;
            }

            if let Ok(config) = device.default_input_config() {
                found_devices.push((device, config.into(), mic_indices));
            }
        }

        Ok(found_devices)
    }

    /// Get the default output device configuration
    pub fn get_output_config(&self) -> Result<(Device, StreamConfig), AppError> {
        let output_device = self
            .host
            .default_output_device()
            .ok_or_else(|| AppError::CpalError("No output device available".to_string()))?;

        let config = output_device.default_output_config()?;
        Ok((output_device, config.into()))
    }
}
