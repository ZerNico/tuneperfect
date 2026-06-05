use serde::{Deserialize, Serialize};

/// Configuration options for a microphone input
#[derive(Debug, Serialize, Deserialize, specta::Type, Clone)]
pub struct MicrophoneOptions {
    /// Stable device ID (cpal `DeviceId`, serialized via `Display`). Preferred
    /// for matching. `None` for configs saved before ID support was added, which
    /// fall back to matching by `name`.
    #[serde(default, rename = "deviceId")]
    pub device_id: Option<String>,
    /// Human-readable device name. Used for display and as a fallback match when
    /// `device_id` is absent or the device's ID can't be read.
    pub name: String,
    pub channel: i32,
    pub gain: f32,
    pub threshold: f32,
    /// Input latency in ms. The pitch window ends this far in the past so the
    /// detected pitch matches the audio sung for the current beat.
    pub delay: f32,
}

/// Default buffer size for audio ring buffers (~85ms at 48kHz)
pub const DEFAULT_BUFFER_SIZE: usize = 4096;
