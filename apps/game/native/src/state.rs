use std::{
    collections::HashMap,
    sync::{Arc, LazyLock, Mutex, RwLock},
};

use tokio::sync::Mutex as TokioMutex;

use crate::{
    audio::{processor::Processor, recorder::Recorder, worker::PitchSinks},
    path_allowlist::PathAllowlist,
    usdb::client::UsdbClient,
};

/// Pitch processors by microphone index. The recorder thread fills it when streams start;
/// the pitch and level queries read it.
pub type ProcessorMap = Arc<RwLock<HashMap<usize, Arc<Mutex<Processor>>>>>;

pub struct AppState {
    pub recorder: RwLock<Option<Recorder>>,
    pub processors: ProcessorMap,
    pub usdb_client: TokioMutex<Option<UsdbClient>>,
    /// Song folders the user granted access to. Gates song parsing and media serving.
    pub allowlist: PathAllowlist,
    /// Subscribers to the live pitch stream (`subscribePitchFrames`).
    pub pitch_sinks: PitchSinks,
}

static STATE: LazyLock<AppState> = LazyLock::new(|| {
    crate::logging::init();

    AppState {
        recorder: RwLock::new(None),
        processors: Arc::new(RwLock::new(HashMap::new())),
        usdb_client: TokioMutex::new(None),
        allowlist: PathAllowlist::default(),
        pitch_sinks: PitchSinks::default(),
    }
});

/// Process-wide state. The addon is loaded once per process, so a global replaces the
/// per-app state Tauri used to manage.
pub fn state() -> &'static AppState {
    &STATE
}
