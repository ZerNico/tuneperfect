use crate::error::AppError;
use crate::media_server::MediaServerState;
use crate::ultrastar::filesystem::traverse_and_find_txt_files;
use crate::ultrastar::parser::parse_local_txt_file;
use crate::ultrastar::song::LocalSong;
use log;
use serde::{Deserialize, Serialize};
use specta::Type;
use std::sync::{Arc, Mutex};
use tauri::State;
use tauri_specta::Event;
use tokio::task;

#[derive(Serialize, Deserialize, Debug, Clone, Type, Event)]
pub struct ProgressEvent {
    pub song: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Type, Event)]
pub struct StartParsingEvent {
    pub total_songs: i32,
}

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
pub struct SongGroup {
    pub path: String,
    pub songs: Vec<LocalSong>,
}

fn get_media_base_url(media_server_state: &State<Arc<Mutex<Option<MediaServerState>>>>) -> String {
    if let Ok(state) = media_server_state.lock() {
        if let Some(server_state) = state.as_ref() {
            let base_url = server_state.get_base_url();
            return base_url;
        }
    }
    #[cfg(any(windows, target_os = "android"))]
    let base = "http://asset.localhost/";
    #[cfg(not(any(windows, target_os = "android")))]
    let base = "asset://localhost/";

    base.to_string()
}

#[tauri::command]
#[specta::specta]
pub async fn parse_songs_from_paths(
    paths: Vec<String>,
    app_handle: tauri::AppHandle,
    media_server_state: State<'_, Arc<Mutex<Option<MediaServerState>>>>,
) -> Result<Vec<SongGroup>, AppError> {
    let media_base_url = get_media_base_url(&media_server_state);

    let txt_files_map = traverse_and_find_txt_files(paths.clone())?;

    let mut song_groups = Vec::new();

    StartParsingEvent {
        total_songs: txt_files_map.len() as i32,
    }
    .emit(&app_handle)
    .unwrap();

    let num_workers = num_cpus::get();

    for start_path in paths {
        let mut songs_for_path = Vec::new();

        let txt_files_for_path: Vec<_> = txt_files_map
            .iter()
            .filter(|(txt_path, _)| txt_path.starts_with(&start_path))
            .map(|(txt_path, files_in_dir)| (txt_path.clone(), files_in_dir.clone()))
            .collect();

        if txt_files_for_path.is_empty() {
            song_groups.push(SongGroup {
                path: start_path,
                songs: songs_for_path,
            });
            continue;
        }

        // Split songs into batches
        let batch_size = (txt_files_for_path.len() + num_workers - 1) / num_workers; // Ceiling division
        let batches: Vec<_> = txt_files_for_path
            .chunks(batch_size)
            .map(|chunk| chunk.to_vec())
            .collect();

        let mut batch_tasks = Vec::new();
        for batch in batches {
            let media_base_url = media_base_url.clone();
            let app_handle = app_handle.clone();

            let batch_task = task::spawn_blocking(move || {
                let mut batch_results = Vec::new();

                for (txt_path, files_in_dir) in batch {
                    match parse_local_txt_file(&txt_path, &files_in_dir, &media_base_url) {
                        Ok(song) => {
                            batch_results.push((txt_path.clone(), Ok(song)));
                        }
                        Err(e) => {
                            log::error!("Failed to parse song at '{}': {}", txt_path, e);
                            batch_results.push((txt_path.clone(), Err(e)));
                        }
                    }

                    // Emit progress event for each song
                    ProgressEvent { song: txt_path }.emit(&app_handle).unwrap();
                }

                batch_results
            });

            batch_tasks.push(batch_task);
        }

        for batch_task in batch_tasks {
            match batch_task.await {
                Ok(batch_results) => {
                    for (txt_path, result) in batch_results {
                        match result {
                            Ok(song) => songs_for_path.push(song),
                            Err(e) => log::error!("Failed to parse song at '{}': {}", txt_path, e),
                        }
                    }
                }
                Err(e) => {
                    log::error!("Batch task join error: {}", e);
                }
            }
        }

        song_groups.push(SongGroup {
            path: start_path,
            songs: songs_for_path,
        });
    }

    Ok(song_groups)
}
