use serde::Serialize;
use thiserror::Error;

#[derive(Error, Debug, Serialize, specta::Type)]
#[serde(tag = "type", content = "data")]
pub enum AppError {
    #[error("io error: {0}")]
    IoError(String),

    #[error("lofty error: {0}")]
    LoftyError(String),

    #[error("recorder error: {0}")]
    RecorderError(String),

    #[error("processor error: {0}")]
    ProcessorError(String),

    #[error("cpal error: {0}")]
    CpalError(String),

    #[error("ultrastar error: {0}")]
    UltrastarError(String),

    #[error("webrtc error: {0}")]
    WebRTCError(String),

    #[error("usdb error: {0}")]
    UsdbError(String),

    #[error("migration error: {0}")]
    MigrationError(String),
}

macro_rules! impl_from_errors {
    ($(($error:ty, $variant:ident)),*) => {
        $(
            impl From<$error> for AppError {
                fn from(e: $error) -> Self {
                    AppError::$variant(e.to_string())
                }
            }
        )*
    };
}

impl_from_errors!(
    (std::io::Error, IoError),
    (lofty::error::FileParseError, LoftyError),
    (cpal::Error, CpalError),
    (tauri_plugin_updater::Error, MigrationError),
    (reqwest::Error, MigrationError),
    (serde_json::Error, MigrationError)
);
