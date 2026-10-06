use crate::error::AppError;
use crate::state::state;
use crate::ultrastar::filesystem::find_txt_files_by_root;
use crate::ultrastar::packed_notes::pack_voices;
use crate::ultrastar::parser::parse_local_txt_file;
use crate::ultrastar::song::LocalSong;
use log;
use serde::{Deserialize, Serialize};
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

/// A scanned library: the songs' metadata, plus all their notes packed into one buffer (as JSON,
/// a big library's notes don't even fit in one string). `note_ranges` holds an offset and a
/// length into `notes` per song, in the order of the groups and their songs.
pub struct ParsedLibrary {
    pub groups: Vec<SongGroup>,
    pub notes: Vec<u8>,
    pub note_ranges: Vec<u32>,
}

pub async fn parse_songs_from_paths(
    paths: Vec<String>,
    on_event: ParseEventSink,
) -> Result<ParsedLibrary, AppError> {
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

    let roots = task::spawn_blocking(move || find_txt_files_by_root(&allowed_paths))
        .await
        .map_err(|e| AppError::IoError(e.to_string()))?;

    let total = roots.iter().map(|(_, files)| files.len()).sum::<usize>() as u32;
    on_event(ParseEvent::Start { total });

    // Counted and reported under one lock, so reports from parallel workers never go backwards.
    let progress = Arc::new(Mutex::new(Progress {
        done: 0,
        last_report: Instant::now(),
    }));
    let num_workers = num_cpus::get();
    let mut song_groups = Vec::with_capacity(roots.len());
    let mut notes = Vec::new();
    let mut note_ranges = Vec::new();

    for (root, txt_files) in roots {
        let mut songs_for_path = Vec::with_capacity(txt_files.len());

        if txt_files.is_empty() {
            song_groups.push(SongGroup {
                path: root,
                songs: songs_for_path,
            });
            continue;
        }

        let batch_size = txt_files.len().div_ceil(num_workers);
        let mut batch_tasks = Vec::new();
        for batch in txt_files.chunks(batch_size).map(<[_]>::to_vec) {
            let media_base_url = media_base_url.clone();
            let on_event = on_event.clone();
            let progress = progress.clone();

            batch_tasks.push(task::spawn_blocking(move || {
                let mut parsed = Vec::with_capacity(batch.len());

                for txt in batch {
                    match parse_local_txt_file(&txt.path, &txt.files, &media_base_url) {
                        Ok(mut song) => {
                            let packed = pack_voices(&song.song.voices);
                            song.song.voices = Vec::new();
                            parsed.push((song, packed));
                        }
                        Err(e) => log::error!("Failed to parse song at '{}': {}", txt.path, e),
                    }

                    let mut progress = progress.lock().unwrap_or_else(|e| e.into_inner());
                    progress.done += 1;
                    if progress.done == total || progress.last_report.elapsed() >= PROGRESS_INTERVAL
                    {
                        progress.last_report = Instant::now();
                        on_event(ParseEvent::Progress {
                            song: txt.path,
                            done: progress.done,
                        });
                    }
                }

                parsed
            }));
        }

        for batch_task in batch_tasks {
            match batch_task.await {
                Ok(parsed) => {
                    for (song, packed) in parsed {
                        note_ranges.extend([notes.len() as u32, packed.len() as u32]);
                        notes.extend_from_slice(&packed);
                        songs_for_path.push(song);
                    }
                }
                Err(e) => log::error!("Batch task join error: {}", e),
            }
        }

        song_groups.push(SongGroup {
            path: root,
            songs: songs_for_path,
        });
    }

    Ok(ParsedLibrary {
        groups: song_groups,
        notes,
        note_ranges,
    })
}

struct Progress {
    done: u32,
    last_report: Instant,
}
