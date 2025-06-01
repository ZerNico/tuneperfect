mod audio;
mod commands;
mod error;
mod media_server;

use std::{
    collections::HashMap,
    sync::{Arc, Mutex, RwLock},
};

use audio::{processor::Processor, recorder::Recorder};
use commands::*;
use media_server::create_media_server_plugin;
use specta_typescript::Typescript;
use tauri::Manager;
use tauri_specta::{collect_commands, Builder};

pub struct AppState {
    recorder: RwLock<Option<Recorder>>,
    processors: RwLock<HashMap<usize, Arc<Mutex<Processor>>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            recorder: RwLock::new(None),
            processors: RwLock::new(HashMap::new()),
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = Builder::<tauri::Wry>::new().commands(collect_commands![
        meta::get_replay_gain,
        microphones::get_microphones,
        pitch::start_recording,
        pitch::stop_recording,
        pitch::get_pitch,
        media_server::get_media_server_base_url,
    ]);

    #[cfg(debug_assertions)]
    builder
        .export(Typescript::default(), "../src/bindings.ts")
        .expect("Failed to export typescript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(create_media_server_plugin())
        .setup(|app| {
            app.manage(AppState::default());
            Ok(())
        })
        .invoke_handler(builder.invoke_handler())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
