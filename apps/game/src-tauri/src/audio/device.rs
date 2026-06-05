use crate::error::AppError;
use cpal::traits::{DeviceTrait, HostTrait};
use cpal::{BufferSize, Device, StreamConfig, SupportedBufferSize};

use super::types::MicrophoneOptions;

/// Stable ID and human-readable name for a cpal device. Either may be missing if
/// the backend fails to report it.
struct DeviceIdentity {
    id: Option<String>,
    name: Option<String>,
}

/// Pick the most descriptive, user-facing name from a device description.
///
/// On Windows/WASAPI (cpal 0.17.x) `name()` returns the generic short
/// `DeviceDesc` (e.g. "Mikrofon"/"Microphone"), which is identical for every
/// device, while the unique `FriendlyName` (e.g. "Mikrofon (USB Audio Device)")
/// is placed in the first `extended()` line. Prefer that friendly line when
/// present, otherwise fall back to `name()`. On macOS/Linux `extended()` is
/// empty, so this returns the regular name unchanged.
pub fn device_display_name(desc: &cpal::DeviceDescription) -> String {
    desc.extended()
        .first()
        .map(String::as_str)
        .unwrap_or_else(|| desc.name())
        .to_string()
}

/// Read a device's stable ID (as a `Display` string) and human-readable name.
/// Both are optional because backends can fail to report either.
fn device_identity(device: &Device) -> DeviceIdentity {
    let id = device.id().ok().map(|id| id.to_string());
    let name = device.description().ok().map(|desc| device_display_name(&desc));
    DeviceIdentity { id, name }
}

/// Whether a stored microphone config refers to this physical device. Matches by
/// stable ID first (preferred), then falls back to the human-readable name for
/// configs saved before device IDs were persisted.
fn mic_matches_device(mic: &MicrophoneOptions, identity: &DeviceIdentity) -> bool {
    if let (Some(stored_id), Some(device_id)) = (mic.device_id.as_deref(), identity.id.as_deref()) {
        if stored_id == device_id {
            return true;
        }
    }

    matches!(identity.name.as_deref(), Some(name) if name == mic.name)
}

/// Target buffer size (in frames) for input/output streams.
///
/// Lower buffer sizes reduce monitoring latency but risk underruns. 256 frames
/// (~5.3ms at 48kHz) is low enough to noticeably cut latency while staying safe
/// across typical devices. It is always clamped to the device's supported range
/// before use, so devices that can't go this low keep a valid (larger) buffer.
const TARGET_BUFFER_SIZE: u32 = 256;

/// Apply a low fixed buffer size to a stream config, clamped to what the device
/// actually supports. Falls back to leaving the default buffer size if the
/// device reports an unknown range.
fn apply_low_latency_buffer_size(config: &mut StreamConfig, supported: &SupportedBufferSize) {
    if let SupportedBufferSize::Range { min, max } = supported {
        let clamped = TARGET_BUFFER_SIZE.clamp(*min, *max);
        config.buffer_size = BufferSize::Fixed(clamped);
    }
}

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

    /// Find all input devices that match the given microphone configs. Matching
    /// prefers each mic's stable `device_id`, falling back to its `name` for
    /// configs saved before IDs were persisted.
    pub fn find_input_devices(
        &self,
        mics: &[MicrophoneOptions],
    ) -> Result<Vec<(Device, StreamConfig, Vec<usize>)>, AppError> {
        let devices = self.host.devices()?;
        let mut found_devices = Vec::new();

        for device in devices {
            let identity = device_identity(&device);
            let mic_indices: Vec<usize> = mics
                .iter()
                .enumerate()
                .filter(|(_, mic)| mic_matches_device(mic, &identity))
                .map(|(idx, _)| idx)
                .collect();

            if mic_indices.is_empty() {
                continue;
            }

            if let Ok(supported_config) = device.default_input_config() {
                let supported_buffer_size = *supported_config.buffer_size();
                let mut config: StreamConfig = supported_config.into();
                apply_low_latency_buffer_size(&mut config, &supported_buffer_size);
                found_devices.push((device, config, mic_indices));
            }
        }

        Ok(found_devices)
    }

    /// Get the default output device configuration.
    ///
    /// When `desired_sample_rate` is provided, we try to configure the output at
    /// that rate so it matches the input and the resampler can be bypassed. If
    /// the device's default config doesn't support that rate, we fall back to the
    /// device default (and the caller will resample).
    pub fn get_output_config(
        &self,
        desired_sample_rate: Option<u32>,
    ) -> Result<(Device, StreamConfig), AppError> {
        let output_device = self
            .host
            .default_output_device()
            .ok_or_else(|| AppError::CpalError("No output device available".to_string()))?;

        let supported_config = output_device.default_output_config()?;
        let supported_buffer_size = *supported_config.buffer_size();
        let mut config: StreamConfig = supported_config.into();

        // Try to match the desired (input) sample rate to avoid resampling.
        if let Some(rate) = desired_sample_rate {
            if rate != config.sample_rate && Self::supports_output_sample_rate(&output_device, rate)
            {
                config.sample_rate = rate;
            }
        }

        apply_low_latency_buffer_size(&mut config, &supported_buffer_size);
        Ok((output_device, config))
    }

    /// Check whether the output device advertises support for a given sample rate.
    fn supports_output_sample_rate(device: &Device, sample_rate: u32) -> bool {
        let Ok(configs) = device.supported_output_configs() else {
            return false;
        };

        configs.into_iter().any(|range| {
            range.min_sample_rate() <= sample_rate && sample_rate <= range.max_sample_rate()
        })
    }
}
