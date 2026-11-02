use crate::error::AppError;
use crate::state::state;
use crate::ultrastar::filesystem::{scan_roots, FileEntry, RootScan};
use crate::ultrastar::packed_notes::pack_voices;
use crate::ultrastar::parser::parse_local_txt_file;
use crate::ultrastar::song::LocalSong;
use log;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant, SystemTime};
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

/// A song folder whose files changed this recently is probably still being copied; a rescan
/// leaves it for the next one.
const SETTLE_TIME: Duration = Duration::from_secs(3);

pub type ParseEventSink = Arc<dyn Fn(ParseEvent) + Send + Sync>;

/// The fingerprint of every song folder below each parsed root (see `SongDir::fingerprint`), as
/// of the last parse or rescan. Rescans compare against it to re-parse only what changed.
pub type KnownSongDirs = HashMap<String, HashMap<String, u64>>;

#[derive(Serialize, Deserialize, Debug, Clone, specta::Type)]
pub struct SongGroup {
    pub path: String,
    pub songs: Vec<LocalSong>,
}

/// Everything that is now in one song folder below `root`. Replaces the songs the folder had
/// before; no songs means the folder is gone (or has no playable songs any more).
#[derive(Serialize, Deserialize, Debug, Clone, specta::Type)]
pub struct SongDirGroup {
    pub root: String,
    pub dir: String,
    pub songs: Vec<LocalSong>,
}

/// Songs' metadata in groups, plus all their notes packed into one buffer (as JSON, a big
/// library's notes don't even fit in one string). `note_ranges` holds an offset and a length
/// into `notes` per song, in the order of the groups and their songs.
pub struct PackedSongs<G> {
    pub groups: Vec<G>,
    pub notes: Vec<u8>,
    pub note_ranges: Vec<u32>,
}

/// A scanned library: one group per root.
pub type ParsedLibrary = PackedSongs<SongGroup>;

/// The song folders that changed since the last parse or rescan.
pub struct Rescan {
    pub changes: PackedSongs<SongDirGroup>,
    /// Parsed roots that are gone right now (e.g. an unplugged drive). Their songs are kept and
    /// come back unchanged, or as changes, once the root is back.
    pub missing_roots: Vec<String>,
    /// Some folders were still being written to and are left for the next rescan.
    pub pending: bool,
}

/// `media_base_url` is where the host serves song files from; each song's media URLs are
/// `{media_base_url}/{percent-encoded absolute path}`.
pub async fn parse_songs_from_paths(
    paths: Vec<String>,
    media_base_url: String,
    on_event: ParseEventSink,
) -> Result<ParsedLibrary, AppError> {
    // One scan at a time, so a rescan never compares against a half-recorded parse.
    let mut known = state().song_dirs.lock().await;
    let allowed_paths = allowed(paths);

    let scans = scan(allowed_paths).await?;

    let total = scans
        .iter()
        .flat_map(|scan| &scan.dirs)
        .map(|dir| dir.txts.len())
        .sum::<usize>() as u32;
    on_event(ParseEvent::Start { total });

    let jobs = scans
        .iter()
        .map(|scan| {
            scan.dirs
                .iter()
                .flat_map(|dir| dir.txts.iter().map(|txt| (txt.clone(), dir.files.clone())))
                .collect()
        })
        .collect();
    let parsed = parse_txts(jobs, &media_base_url, total, Some(on_event)).await;

    for scan in &scans {
        if !scan.missing {
            known.insert(scan.root.clone(), fingerprints(scan));
        }
    }

    Ok(pack(scans.into_iter().zip(parsed).map(|(scan, songs)| {
        (
            SongGroup {
                path: scan.root,
                songs: Vec::new(),
            },
            songs,
        )
    })))
}

/// Re-parses the song folders that changed below the parsed roots among `paths` since the
/// last parse or rescan. Pass every song folder the library has (not only some): which root a
/// nested folder belongs to depends on the others. Parsed roots that aren't among `paths`
/// are forgotten; roots that weren't parsed yet are left to `parse_songs_from_paths`.
pub async fn rescan_songs(paths: Vec<String>, media_base_url: String) -> Result<Rescan, AppError> {
    rescan_settled(paths, media_base_url, SETTLE_TIME).await
}

async fn rescan_settled(
    paths: Vec<String>,
    media_base_url: String,
    settle_time: Duration,
) -> Result<Rescan, AppError> {
    let mut known = state().song_dirs.lock().await;
    known.retain(|root, _| paths.contains(root));
    let allowed_paths = allowed(paths);

    let mut rescan = Rescan {
        changes: PackedSongs {
            groups: Vec::new(),
            notes: Vec::new(),
            note_ranges: Vec::new(),
        },
        missing_roots: Vec::new(),
        pending: false,
    };
    if known.is_empty() {
        return Ok(rescan);
    }

    // A root that is gone can't be resolved, so it also isn't "allowed" any more.
    rescan.missing_roots = known
        .keys()
        .filter(|root| !allowed_paths.contains(root))
        .cloned()
        .collect();

    let scans = scan(allowed_paths).await?;
    let now = SystemTime::now();

    let mut removed = Vec::new();
    let mut changed = Vec::new();
    for scan in &scans {
        let Some(old) = known.get(&scan.root) else {
            continue;
        };
        if scan.missing {
            rescan.missing_roots.push(scan.root.clone());
            continue;
        }

        let present: HashSet<&str> = scan.dirs.iter().map(|dir| dir.dir.as_str()).collect();
        for dir in old.keys() {
            // Below a folder that couldn't be read this time: unknown, not gone.
            let unknown = scan
                .unreadable
                .iter()
                .any(|unreadable| Path::new(dir).starts_with(unreadable));
            if !present.contains(dir.as_str()) && !unknown {
                removed.push((scan.root.clone(), dir.clone()));
            }
        }

        for dir in &scan.dirs {
            if old.get(&dir.dir) == Some(&dir.fingerprint) {
                continue;
            }
            let settling = dir
                .newest_change
                .and_then(|time| now.duration_since(time).ok())
                .is_some_and(|age| age < settle_time);
            if settling {
                rescan.pending = true;
                continue;
            }
            changed.push((scan.root.clone(), dir));
        }
    }

    if removed.is_empty() && changed.is_empty() {
        return Ok(rescan);
    }

    let jobs = changed
        .iter()
        .map(|(_, dir)| {
            dir.txts
                .iter()
                .map(|txt| (txt.clone(), dir.files.clone()))
                .collect()
        })
        .collect();
    let total = changed.iter().map(|(_, dir)| dir.txts.len()).sum::<usize>() as u32;
    let parsed = parse_txts(jobs, &media_base_url, total, None).await;

    for (root, dir) in &removed {
        if let Some(dirs) = known.get_mut(root) {
            dirs.remove(dir);
        }
        log::info!("Song folder removed: {}", dir);
    }
    for (root, dir) in &changed {
        if let Some(dirs) = known.get_mut(root) {
            dirs.insert(dir.dir.clone(), dir.fingerprint);
        }
        log::info!("Song folder changed: {}", dir.dir);
    }

    let groups = changed
        .iter()
        .zip(parsed)
        .map(|((root, dir), songs)| (root.clone(), dir.dir.clone(), songs))
        .chain(
            removed
                .into_iter()
                .map(|(root, dir)| (root, dir, Vec::new())),
        )
        .map(|(root, dir, songs)| {
            (
                SongDirGroup {
                    root,
                    dir,
                    songs: Vec::new(),
                },
                songs,
            )
        });
    rescan.changes = pack(groups);
    Ok(rescan)
}

fn allowed(paths: Vec<String>) -> Vec<String> {
    let allowlist = &state().allowlist;
    paths
        .into_iter()
        .filter(|path| {
            if !allowlist.is_allowed(path) {
                log::warn!("Skipping disallowed path: {}", path);
                false
            } else {
                true
            }
        })
        .collect()
}

async fn scan(roots: Vec<String>) -> Result<Vec<RootScan>, AppError> {
    task::spawn_blocking(move || scan_roots(&roots))
        .await
        .map_err(|e| AppError::IoError(e.to_string()))
}

fn fingerprints(scan: &RootScan) -> HashMap<String, u64> {
    scan.dirs
        .iter()
        .map(|dir| (dir.dir.clone(), dir.fingerprint))
        .collect()
}

type ParsedSong = (LocalSong, Vec<u8>);

/// Parses the song files of each group in parallel, keeping their order. Files that fail to
/// parse are logged and left out.
async fn parse_txts(
    groups: Vec<Vec<(String, Arc<Vec<FileEntry>>)>>,
    media_base_url: &str,
    total: u32,
    on_event: Option<ParseEventSink>,
) -> Vec<Vec<ParsedSong>> {
    let mut parsed: Vec<Vec<ParsedSong>> = groups.iter().map(|_| Vec::new()).collect();
    let jobs: Vec<(usize, String, Arc<Vec<FileEntry>>)> = groups
        .into_iter()
        .enumerate()
        .flat_map(|(group, txts)| {
            txts.into_iter()
                .map(move |(txt, files)| (group, txt, files))
        })
        .collect();
    if jobs.is_empty() {
        return parsed;
    }

    // Counted and reported under one lock, so reports from parallel workers never go backwards.
    let progress = Arc::new(Mutex::new(Progress {
        done: 0,
        last_report: Instant::now(),
    }));
    let batch_size = jobs.len().div_ceil(num_cpus::get());
    let mut batch_tasks = Vec::new();
    for batch in jobs.chunks(batch_size).map(<[_]>::to_vec) {
        let media_base_url = media_base_url.to_string();
        let on_event = on_event.clone();
        let progress = progress.clone();

        batch_tasks.push(task::spawn_blocking(move || {
            let mut parsed = Vec::with_capacity(batch.len());

            for (group, txt, files) in batch {
                match parse_local_txt_file(&txt, &files, &media_base_url) {
                    Ok(mut song) => {
                        let packed = pack_voices(&song.song.voices);
                        song.song.voices = Vec::new();
                        parsed.push((group, (song, packed)));
                    }
                    Err(e) => log::error!("Failed to parse song at '{}': {}", txt, e),
                }

                if let Some(on_event) = &on_event {
                    let mut progress = progress.lock().unwrap_or_else(|e| e.into_inner());
                    progress.done += 1;
                    if progress.done == total || progress.last_report.elapsed() >= PROGRESS_INTERVAL
                    {
                        progress.last_report = Instant::now();
                        on_event(ParseEvent::Progress {
                            song: txt,
                            done: progress.done,
                        });
                    }
                }
            }

            parsed
        }));
    }

    for batch_task in batch_tasks {
        match batch_task.await {
            Ok(batch) => {
                for (group, song) in batch {
                    parsed[group].push(song);
                }
            }
            Err(e) => log::error!("Batch task join error: {}", e),
        }
    }
    parsed
}

/// Fills each group with its songs, moving their notes into one buffer.
fn pack<G: HasSongs>(groups: impl Iterator<Item = (G, Vec<ParsedSong>)>) -> PackedSongs<G> {
    let mut packed = PackedSongs {
        groups: Vec::new(),
        notes: Vec::new(),
        note_ranges: Vec::new(),
    };
    for (mut group, songs) in groups {
        let target = group.songs_mut();
        target.reserve(songs.len());
        for (song, notes) in songs {
            packed
                .note_ranges
                .extend([packed.notes.len() as u32, notes.len() as u32]);
            packed.notes.extend_from_slice(&notes);
            target.push(song);
        }
        packed.groups.push(group);
    }
    packed
}

trait HasSongs {
    fn songs_mut(&mut self) -> &mut Vec<LocalSong>;
}

impl HasSongs for SongGroup {
    fn songs_mut(&mut self) -> &mut Vec<LocalSong> {
        &mut self.songs
    }
}

impl HasSongs for SongDirGroup {
    fn songs_mut(&mut self) -> &mut Vec<LocalSong> {
        &mut self.songs
    }
}

struct Progress {
    done: u32,
    last_report: Instant,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;

    const SONG: &str =
        "#TITLE:Title\n#ARTIST:Artist\n#MP3:song.mp3\n#BPM:100\n#GAP:0\n: 0 4 60 la\nE\n";

    fn temp_root(name: &str) -> PathBuf {
        let dir =
            std::env::temp_dir().join(format!("tp-rescan-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn song(dir: &Path, title: &str) {
        fs::create_dir_all(dir).unwrap();
        fs::write(dir.join("song.txt"), SONG.replace("Title", title)).unwrap();
        fs::write(dir.join("song.mp3"), "").unwrap();
    }

    fn titles(rescan: &Rescan) -> Vec<(String, Vec<String>)> {
        let mut groups: Vec<_> = rescan
            .changes
            .groups
            .iter()
            .map(|group| {
                let name = Path::new(&group.dir)
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .to_string();
                (
                    name,
                    group
                        .songs
                        .iter()
                        .map(|song| song.song.title.clone())
                        .collect(),
                )
            })
            .collect();
        groups.sort();
        groups
    }

    #[tokio::test]
    async fn rescans_only_what_changed() {
        let base = temp_root("changes");
        let root = base.to_string_lossy().to_string();
        song(&base.join("a"), "A");
        song(&base.join("b"), "B");
        assert!(state().allowlist.allow_directory(&root));
        let rescan = |settle| rescan_settled(vec![root.clone()], "media://x".into(), settle);

        // Not parsed yet: nothing to compare against.
        assert!(rescan(Duration::ZERO)
            .await
            .unwrap()
            .changes
            .groups
            .is_empty());

        let library =
            parse_songs_from_paths(vec![root.clone()], "media://x".into(), Arc::new(|_| {}))
                .await
                .unwrap();
        assert_eq!(library.groups[0].songs.len(), 2);
        assert!(library.groups[0].songs[0].txt_path.ends_with("song.txt"));
        assert!(rescan(Duration::ZERO)
            .await
            .unwrap()
            .changes
            .groups
            .is_empty());

        song(&base.join("c"), "C");
        fs::write(base.join("a/song.txt"), SONG.replace("Title", "A2")).unwrap();
        fs::remove_dir_all(base.join("b")).unwrap();

        // Just written: left for later.
        let early = rescan(Duration::from_secs(60)).await.unwrap();
        assert!(early.pending);
        assert_eq!(titles(&early), [("b".to_string(), vec![])]);

        let changes = rescan(Duration::ZERO).await.unwrap();
        assert!(!changes.pending);
        assert_eq!(
            titles(&changes),
            [
                ("a".to_string(), vec!["A2".to_string()]),
                ("c".to_string(), vec!["C".to_string()])
            ]
        );
        assert_eq!(changes.changes.note_ranges.len(), 4);
        assert!(rescan(Duration::ZERO)
            .await
            .unwrap()
            .changes
            .groups
            .is_empty());

        // A root that is gone keeps its songs and is reported.
        fs::rename(&base, base.with_extension("away")).unwrap();
        let away = rescan(Duration::ZERO).await.unwrap();
        assert_eq!(away.missing_roots, std::slice::from_ref(&root));
        assert!(away.changes.groups.is_empty());
        fs::rename(base.with_extension("away"), &base).unwrap();
        assert!(rescan(Duration::ZERO)
            .await
            .unwrap()
            .changes
            .groups
            .is_empty());

        // Roots left out are forgotten.
        assert!(rescan_settled(vec![], "media://x".into(), Duration::ZERO)
            .await
            .unwrap()
            .changes
            .groups
            .is_empty());
        assert!(!state().song_dirs.lock().await.contains_key(&root));
        let _ = fs::remove_dir_all(base);
    }
}
