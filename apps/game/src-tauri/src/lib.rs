mod audio;
mod commands;
mod error;
mod media_server;
mod ultrastar;

use std::{
    collections::HashMap,
    sync::{Arc, Mutex, RwLock},
};

use audio::{processor::Processor, recorder::Recorder};
use commands::*;
use media_server::create_media_server_plugin;
use specta_typescript::Typescript;
use tauri::Manager;
use tauri_plugin_cli::CliExt;
use tauri_plugin_fs::FsExt;
use tauri_specta::{collect_commands, collect_events, Builder};

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
    let builder = Builder::<tauri::Wry>::new()
        .commands(collect_commands![
            meta::get_replay_gain,
            microphones::get_microphones,
            pitch::start_recording,
            pitch::stop_recording,
            pitch::get_pitch,
            media_server::get_media_server_base_url,
            songs::parse_songs_from_paths,
        ])
        .events(collect_events![
            songs::ProgressEvent,
            songs::StartParsingEvent
        ]);

    #[cfg(debug_assertions)]
    builder
        .export(Typescript::default(), "../src/bindings.ts")
        .expect("Failed to export typescript bindings");

    tauri::Builder::default()
        .plugin(tauri_plugin_os::init())
        .plugin(
            tauri_plugin_log::Builder::new()
                .level(log::LevelFilter::Info)
                .filter(|metadata| !metadata.target().starts_with("lofty"))
                .build(),
        )
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            let _ = app
                .get_webview_window("main")
                .expect("no main window")
                .set_focus();
        }))
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_persisted_scope::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_window_state::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(create_media_server_plugin())
        .invoke_handler(builder.invoke_handler())
        .setup(move |app| {
            let fs_scope = app.fs_scope();
            let asset_scope = app.asset_protocol_scope();

            match app.cli().matches() {
                Ok(matches) => {
                    if let Some(songpath) = matches.args.get("songpath") {
                        if let Some(paths) = songpath.value.as_array() {
                            for path in paths {
                                if let Some(path_str) = path.as_str() {
                                    fs_scope.allow_directory(path_str, true)?;
                                    asset_scope.allow_directory(path_str, true)?;
                                }
                            }
                        }
                    }
                }
                Err(_) => {}
            }

            app.manage(AppState::default());
            builder.mount_events(app);

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
