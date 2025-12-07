use serde::{Deserialize, Serialize};

/// Configuration options for a microphone input
#[derive(Debug, Serialize, Deserialize, specta::Type, Clone)]
pub struct MicrophoneOptions {
    pub name: String,
    pub channel: i32,
    pub gain: f32,
    pub threshold: f32,
}

/// Default buffer size for audio ring buffers (~85ms at 48kHz)
pub const DEFAULT_BUFFER_SIZE: usize = 4096;
