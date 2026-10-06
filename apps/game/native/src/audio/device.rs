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
        .next()
        .unwrap_or_else(|| desc.name())
        .to_string()
}

/// Read a device's stable ID (as a `Display` string) and human-readable name.
/// Both are optional because backends can fail to report either.
fn device_identity(device: &Device) -> DeviceIdentity {
    let id = device.id().ok().map(|id| id.to_string());
    let name = device
        .description()
        .ok()
        .map(|desc| device_display_name(&desc));
    DeviceIdentity { id, name }
}

/// The one device each microphone config records from, as an index into `devices`.
///
/// A mic's stored ID wins. Its name is only a fallback, for configs saved before IDs were
/// stored or whose device got a new ID: names aren't unique. ALSA, for one, lists the same
/// card as `hw:`, `plughw:` and more under one name, and opening several of them fails
/// because the first one holds the hardware.
fn assign_mics(mics: &[MicrophoneOptions], devices: &[DeviceIdentity]) -> Vec<Option<usize>> {
    mics.iter()
        .map(|mic| {
            let by_id = mic.device_id.as_deref().and_then(|stored_id| {
                devices
                    .iter()
                    .position(|device| device.id.as_deref() == Some(stored_id))
            });
            by_id.or_else(|| {
                devices
                    .iter()
                    .position(|device| device.name.as_deref() == Some(mic.name.as_str()))
            })
        })
        .collect()
}

/// Target buffer size (in frames) for input streams and, outside Linux, the playback stream.
///
/// Lower buffer sizes reduce monitoring latency but risk underruns. 256 frames
/// (~5.3ms at 48kHz) is low enough to noticeably cut latency while staying safe
/// across typical devices. It is always clamped to the device's supported range
/// before use, so devices that can't go this low keep a valid (larger) buffer.
const TARGET_BUFFER_SIZE: u32 = 256;

/// Target buffer size (in frames) for the playback stream on Linux.
///
/// There the output is ALSA's `default`, usually PipeWire, which runs every stream at the
/// quantum the smallest one asks for. 256 frames is below what some outputs keep up with:
/// the sound card underruns and all sound stops, the game's music too, for as long as
/// playback runs. 512 is what Chromium asks for the game's own audio, so playback never
/// makes the graph run faster than it already does.
const LINUX_OUTPUT_BUFFER_SIZE: u32 = 512;

/// Apply a fixed buffer size to a stream config, clamped to what the device
/// actually supports. Falls back to leaving the default buffer size if the
/// device reports an unknown range.
fn apply_buffer_size(config: &mut StreamConfig, supported: &SupportedBufferSize, target: u32) {
    if let SupportedBufferSize::Range { min, max } = supported {
        let clamped = target.clamp(*min, *max);
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

    /// The input devices for the given microphone configs, each with the indices of the
    /// mics it records for. Every mic gets at most one device (see [`assign_mics`]).
    pub fn find_input_devices(
        &self,
        mics: &[MicrophoneOptions],
    ) -> Result<Vec<(Device, StreamConfig, Vec<usize>)>, AppError> {
        let inputs: Vec<(Device, StreamConfig)> = self
            .host
            .devices()?
            .filter_map(|device| {
                let supported_config = device.default_input_config().ok()?;
                let supported_buffer_size = *supported_config.buffer_size();
                let mut config: StreamConfig = supported_config.into();
                apply_buffer_size(&mut config, &supported_buffer_size, TARGET_BUFFER_SIZE);
                Some((device, config))
            })
            .collect();
        let identities: Vec<DeviceIdentity> = inputs
            .iter()
            .map(|(device, _)| device_identity(device))
            .collect();

        let mut mics_per_device: Vec<Vec<usize>> = vec![Vec::new(); inputs.len()];
        for (mic_index, device_index) in assign_mics(mics, &identities).into_iter().enumerate() {
            match device_index {
                Some(device_index) => mics_per_device[device_index].push(mic_index),
                None => log::warn!("Microphone {:?} is not connected", mics[mic_index].name),
            }
        }

        Ok(inputs
            .into_iter()
            .zip(mics_per_device)
            .filter(|(_, mic_indices)| !mic_indices.is_empty())
            .map(|((device, config), mic_indices)| (device, config, mic_indices))
            .collect())
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

        let target = if cfg!(target_os = "linux") {
            LINUX_OUTPUT_BUFFER_SIZE
        } else {
            TARGET_BUFFER_SIZE
        };
        apply_buffer_size(&mut config, &supported_buffer_size, target);
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

#[cfg(test)]
mod tests {
    use super::*;

    fn mic(device_id: Option<&str>, name: &str) -> MicrophoneOptions {
        MicrophoneOptions {
            device_id: device_id.map(str::to_owned),
            name: name.to_owned(),
            channel: 0,
            gain: 1.0,
            threshold: 1.0,
            delay: 0.0,
        }
    }

    fn device(id: &str, name: &str) -> DeviceIdentity {
        DeviceIdentity {
            id: Some(id.to_owned()),
            name: Some(name.to_owned()),
        }
    }

    /// One USB card the way ALSA lists it: several devices under the same name.
    fn usb_card() -> Vec<DeviceIdentity> {
        vec![
            device("alsa:default", "Default Audio Device"),
            device(
                "alsa:hw:CARD=Device,DEV=0",
                "USB PnP Sound Device, USB Audio",
            ),
            device(
                "alsa:plughw:CARD=Device,DEV=0",
                "USB PnP Sound Device, USB Audio",
            ),
            device(
                "alsa:dsnoop:CARD=Device,DEV=0",
                "USB PnP Sound Device, USB Audio",
            ),
        ]
    }

    #[test]
    fn stored_id_picks_exactly_that_device() {
        let mics = [mic(
            Some("alsa:plughw:CARD=Device,DEV=0"),
            "USB PnP Sound Device, USB Audio",
        )];
        assert_eq!(assign_mics(&mics, &usb_card()), vec![Some(2)]);
    }

    #[test]
    fn name_is_a_fallback_for_one_device_only() {
        let without_id = [mic(None, "USB PnP Sound Device, USB Audio")];
        assert_eq!(assign_mics(&without_id, &usb_card()), vec![Some(1)]);

        let gone_id = [mic(
            Some("alsa:hw:CARD=Old,DEV=0"),
            "USB PnP Sound Device, USB Audio",
        )];
        assert_eq!(assign_mics(&gone_id, &usb_card()), vec![Some(1)]);
    }

    #[test]
    fn mics_may_share_a_device_and_may_be_missing() {
        let mics = [
            mic(
                Some("alsa:dsnoop:CARD=Device,DEV=0"),
                "USB PnP Sound Device, USB Audio",
            ),
            mic(
                Some("alsa:dsnoop:CARD=Device,DEV=0"),
                "USB PnP Sound Device, USB Audio",
            ),
            mic(Some("alsa:hw:CARD=Other,DEV=0"), "Other Mic"),
        ];
        assert_eq!(
            assign_mics(&mics, &usb_card()),
            vec![Some(3), Some(3), None]
        );
    }
}
