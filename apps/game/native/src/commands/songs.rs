use crate::error::AppError;
use crate::state::state;
use crate::ultrastar::filesystem::traverse_and_find_txt_files;
use crate::ultrastar::parser::parse_local_txt_file;
use crate::ultrastar::song::LocalSong;
use log;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU32, Ordering};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use tokio::task;

/// Reported while parsing, in order: one `Start`, then `Progress` with the number of files done
/// so far. Progress is throttled (see `PROGRESS_INTERVAL`); the last file is always reported.
#[derive(Serialize, Debug, Clone, specta::Type)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum ParseEvent {
    Start { total: u32 },
    Progress { song: String, done: u32 },
}

/// One progress event per file would be tens of thousands of IPC messages and renders for a big
/// library; a loading bar needs a few per second.
const PROGRESS_INTERVAL: Duration = Duration::from_millis(50);

pub type ParseEventSink = Arc<dyn Fn(ParseEvent) + Send + Sync>;

#[derive(Serialize, Deserialize, Debug, Clone, specta::Type)]
pub struct SongGroup {
    pub path: String,
    pub songs: Vec<LocalSong>,
}

/// Base URL that song media files are addressed through: the loopback media server,
/// which serves them to the webview on every platform.
fn get_media_base_url() -> Result<String, AppError> {
    state()
        .local_server
        .get()
        .map(|server| server.get_media_base_url())
        .ok_or_else(|| AppError::IoError("local media server is not running".to_string()))
}

pub async fn parse_songs_from_paths(
    paths: Vec<String>,
    on_event: ParseEventSink,
) -> Result<Vec<SongGroup>, AppError> {
    let media_base_url = get_media_base_url()?;
    let allowlist = &state().allowlist;

    let allowed_paths: Vec<String> = paths
        .into_iter()
        .filter(|path| {
            if !allowlist.is_allowed(path) {
                log::warn!("Skipping disallowed path: {}", path);
                false
            } else {
                true
            }
        })
        .collect();

    let txt_files_map = traverse_and_find_txt_files(allowed_paths.clone())?;

    let mut song_groups = Vec::new();

    let total = txt_files_map.len() as u32;
    on_event(ParseEvent::Start { total });

    let done = Arc::new(AtomicU32::new(0));
    let last_report = Arc::new(Mutex::new(Instant::now()));

    let num_workers = num_cpus::get();

    for start_path in allowed_paths {
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
            let on_event = on_event.clone();
            let done = done.clone();
            let last_report = last_report.clone();

            let batch_task = task::spawn_blocking(move || {
                let mut batch_results = Vec::new();

                for (txt_path, files_in_dir) in batch {
                    match parse_local_txt_file(&txt_path, &files_in_dir, &media_base_url) {
                        Ok(mut song) => {
                            // The library keeps metadata only: every note of every song would
                            // be gigabytes across IPC. Voices are loaded per song when needed.
                            song.song.voices = Vec::new();
                            batch_results.push((txt_path.clone(), Ok(song)));
                        }
                        Err(e) => {
                            log::error!("Failed to parse song at '{}': {}", txt_path, e);
                            batch_results.push((txt_path.clone(), Err(e)));
                        }
                    }

                    let finished = done.fetch_add(1, Ordering::Relaxed) + 1;
                    let due = {
                        let mut last = last_report.lock().unwrap_or_else(|e| e.into_inner());
                        let due = finished == total || last.elapsed() >= PROGRESS_INTERVAL;
                        if due {
                            *last = Instant::now();
                        }
                        due
                    };
                    if due {
                        on_event(ParseEvent::Progress {
                            song: txt_path,
                            done: finished,
                        });
                    }
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

/// The voices of one song file below an allowed folder.
pub fn load_song_voices(txt_path: &str) -> Result<Vec<crate::ultrastar::song::Voice>, AppError> {
    if !state().allowlist.is_allowed(txt_path) {
        return Err(AppError::IoError(format!("Path is not allowed: {txt_path}")));
    }
    crate::ultrastar::parser::parse_txt_voices(txt_path)
}
