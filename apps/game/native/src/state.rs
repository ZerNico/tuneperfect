use std::{
    collections::HashMap,
    sync::{Arc, LazyLock, Mutex, OnceLock, RwLock},
};

use tokio::sync::Mutex as TokioMutex;

use crate::{
    audio::{processor::Processor, recorder::Recorder},
    local_server::LocalServerState,
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
    pub allowlist: Arc<PathAllowlist>,
    pub local_server: OnceLock<LocalServerState>,
}

static STATE: LazyLock<AppState> = LazyLock::new(|| {
    // The host process has no logger for the `log` macros, so install one on first use.
    let _ = env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info,lofty=off")).try_init();

    AppState {
        recorder: RwLock::new(None),
        processors: Arc::new(RwLock::new(HashMap::new())),
        usdb_client: TokioMutex::new(None),
        allowlist: Arc::new(PathAllowlist::default()),
        local_server: OnceLock::new(),
    }
});

/// Process-wide state. The addon is loaded once per process, so a global replaces the
/// per-app state Tauri used to manage.
pub fn state() -> &'static AppState {
    &STATE
}
