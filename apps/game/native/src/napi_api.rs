//! The addon's JavaScript surface. Every export is async so no native work runs on the
//! Electron main thread: blocking calls (device enumeration, stopping the recorder) are
//! moved onto tokio's blocking pool.
//!
//! Structured values cross as JSON-compatible objects (`serde_json::Value`) so the serde
//! shapes the frontend already knows are preserved exactly. Failures reject with an
//! `Error` whose message is the serialized `AppError` (`{"type": ..., "data": ...}`).

use std::sync::Arc;

use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use serde::Serialize;
use serde_json::Value;

use crate::audio::MicrophoneOptions;
use crate::commands::{microphones, pitch, songs};
use crate::error::AppError;
use crate::local_server;
use crate::state::state;
use crate::usdb::commands as usdb;

/// A JS callback that receives one JSON value per call and whose return value is ignored.
type JsonCallback = ThreadsafeFunction<Value, (), Value, Status, false>;
/// Like `JsonCallback`, but doesn't keep the process alive on its own.
type WeakJsonCallback = ThreadsafeFunction<Value, (), Value, Status, false, true>;

impl From<AppError> for Error {
    fn from(error: AppError) -> Self {
        let message = serde_json::to_string(&error).unwrap_or_else(|_| error.to_string());
        Error::new(Status::GenericFailure, message)
    }
}

fn to_json<T: Serialize>(value: T) -> Result<Value> {
    serde_json::to_value(value).map_err(|e| Error::from(AppError::IoError(e.to_string())))
}

fn from_json<T: serde::de::DeserializeOwned>(value: Value) -> Result<T> {
    serde_json::from_value(value).map_err(|e| Error::new(Status::InvalidArg, e.to_string()))
}

async fn blocking<T, F>(f: F) -> Result<T>
where
    T: Send + 'static,
    F: FnOnce() -> std::result::Result<T, AppError> + Send + 'static,
{
    tokio::task::spawn_blocking(f)
        .await
        .map_err(|e| Error::from_reason(e.to_string()))?
        .map_err(Error::from)
}

fn widen(values: Vec<f32>) -> Vec<f64> {
    values.into_iter().map(f64::from).collect()
}

/// Receives the addon's log records (`{level, target, message}`, info and above) so the
/// host can write them to its log file.
#[napi]
pub fn set_log_sink(
    #[napi(ts_arg_type = "(record: { level: string; target: string; message: string }) => void")]
    on_record: WeakJsonCallback,
) {
    crate::state::state();
    crate::logging::set_sink(Box::new(move |record| {
        if let Ok(value) = serde_json::to_value(record) {
            on_record.call(value, ThreadsafeFunctionCallMode::NonBlocking);
        }
    }));
}

/// Writes the renderer's TypeScript types (development builds with the `typegen` feature).
#[cfg(feature = "typegen")]
#[napi]
pub fn export_typescript_types(path: String) -> Result<()> {
    crate::typescript::export(std::path::Path::new(&path)).map_err(Error::from_reason)
}

/// Starts the loopback media server and returns its origin. Idempotent.
#[napi]
pub async fn start_local_server(frame_ancestors: Vec<String>) -> Result<String> {
    let state = state();
    if let Some(server) = state.local_server.get() {
        return Ok(server.get_base_url());
    }

    let server = local_server::start(frame_ancestors, state.allowlist.clone())
        .map_err(|e| Error::from(AppError::IoError(e)))?;
    let base_url = server.get_base_url();
    let _ = state.local_server.set(server);
    Ok(base_url)
}

#[napi]
pub fn get_local_server_base_url() -> Option<String> {
    state()
        .local_server
        .get()
        .map(|server| server.get_base_url())
}

/// Grants the app access to a song folder. Returns `false` if it doesn't exist.
#[napi]
pub fn allow_directory(path: String) -> bool {
    state().allowlist.allow_directory(&path)
}

#[napi]
pub async fn get_microphones() -> Result<Value> {
    let microphones = blocking(microphones::get_microphones).await?;
    to_json(microphones)
}

#[napi]
pub async fn start_recording(
    options: Value,
    playback_enabled: bool,
    playback_volume: f64,
) -> Result<()> {
    let options: Vec<MicrophoneOptions> = from_json(options)?;
    blocking(move || pitch::start_recording(options, playback_enabled, playback_volume as f32))
        .await
}

#[napi]
pub async fn stop_recording() -> Result<()> {
    blocking(pitch::stop_recording).await
}

/// Median pitch in Hz per microphone over the last `window_ms`; `-1` where there is none.
#[napi]
pub async fn get_pitches(window_ms: f64) -> Result<Vec<f64>> {
    Ok(widen(pitch::get_pitches(window_ms as f32).await?))
}

#[napi]
pub async fn get_audio_levels() -> Result<Vec<f64>> {
    Ok(widen(pitch::get_audio_levels().await?))
}

/// A scanned library (see `songs::ParsedLibrary`). `groups` are `SongGroup`s.
#[napi(object)]
pub struct ParsedSongs {
    pub groups: Value,
    pub notes: Uint8Array,
    pub note_ranges: Uint32Array,
}

/// Parses every song below the given (allowed) folders. `on_event` receives
/// `{type: "start", total}` once, then `{type: "progress", song, done}` as files are parsed.
#[napi]
pub async fn parse_songs_from_paths(
    paths: Vec<String>,
    #[napi(
        ts_arg_type = "(event: { type: \"start\"; total: number } | { type: \"progress\"; song: string; done: number }) => void"
    )]
    on_event: JsonCallback,
) -> Result<ParsedSongs> {
    let on_event = Arc::new(on_event);
    let sink: songs::ParseEventSink = Arc::new(move |event| {
        if let Ok(value) = serde_json::to_value(event) {
            on_event.call(value, ThreadsafeFunctionCallMode::NonBlocking);
        }
    });

    let library = songs::parse_songs_from_paths(paths, sink).await?;
    Ok(ParsedSongs {
        groups: to_json(library.groups)?,
        notes: Uint8Array::new(library.notes),
        note_ranges: Uint32Array::new(library.note_ranges),
    })
}

#[napi]
pub async fn usdb_login(username: String, password: String) -> Result<bool> {
    Ok(usdb::usdb_login(username, password).await?)
}

#[napi]
pub async fn usdb_logout() -> Result<()> {
    Ok(usdb::usdb_logout().await?)
}

#[napi]
pub async fn usdb_is_logged_in() -> Result<bool> {
    Ok(usdb::usdb_is_logged_in().await?)
}

/// `on_progress` receives `{fetched, total}` after each catalog page.
#[napi]
pub async fn usdb_fetch_catalog(
    last_mtime: i32,
    last_song_ids: Vec<u32>,
    #[napi(ts_arg_type = "(progress: { fetched: number; total: number }) => void")]
    on_progress: JsonCallback,
) -> Result<Value> {
    let sink = move |event: usdb::UsdbSyncProgressEvent| {
        if let Ok(value) = serde_json::to_value(event) {
            on_progress.call(value, ThreadsafeFunctionCallMode::NonBlocking);
        }
    };

    let catalog = usdb::usdb_fetch_catalog(&sink, last_mtime, last_song_ids).await?;
    to_json(catalog)
}

#[napi]
pub async fn usdb_get_song_preview(song_id: u32) -> Result<Value> {
    to_json(usdb::usdb_get_song_preview(song_id).await?)
}

#[napi]
pub async fn usdb_get_song(song_id: u32) -> Result<Value> {
    to_json(usdb::usdb_get_song(song_id).await?)
}
