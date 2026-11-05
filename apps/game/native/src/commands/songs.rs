use crate::error::AppError;
use crate::path_allowlist::PathAllowlist;
use crate::state::state;
use crate::ultrastar::filesystem::{scan_roots, FileEntry, RootScan, SongDir};
use crate::ultrastar::packed_notes::pack_voices;
use crate::ultrastar::parser::parse_local_txt_file;
use crate::ultrastar::song::LocalSong;
use log;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::path::Path;
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

/// What the last parse or rescan found below each parsed root. Rescans compare against it to
/// re-parse only the song folders that changed.
#[derive(Default)]
pub struct KnownSongDirs {
    roots: HashMap<String, KnownRoot>,
}

#[derive(Default)]
struct KnownRoot {
    /// The fingerprint of every song folder (see `SongDir::fingerprint`) as it was parsed.
    dirs: HashMap<String, u64>,
    /// Folders that changed in the last rescan, with their new fingerprint. A folder is parsed
    /// again once it looks the same in two rescans in a row: until then it's probably still being
    /// copied or unpacked (which keeps the files' original modification times, so those can't tell).
    unsettled: HashMap<String, u64>,
}

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

// Not derived: that would require `G: Default`.
impl<G> Default for PackedSongs<G> {
    fn default() -> Self {
        Self {
            groups: Vec::new(),
            notes: Vec::new(),
            note_ranges: Vec::new(),
        }
    }
}

/// A scanned library: one group per root that could be read.
pub type ParsedLibrary = PackedSongs<SongGroup>;

/// The song folders that changed since the last parse or rescan.
#[derive(Default)]
pub struct Rescan {
    pub changes: PackedSongs<SongDirGroup>,
    /// Parsed roots that are gone right now (e.g. an unplugged drive). Their songs are kept and
    /// come back unchanged, or as changes, once the root is back.
    pub missing_roots: Vec<String>,
    /// Some folders were still being written to and are left for the next rescan.
    pub pending: bool,
}

/// `media_base_url` is where the host serves song files from; each song's media URLs are
/// `{media_base_url}/{percent-encoded absolute path}`. Roots that can't be read are left out of
/// the result (and can be parsed again later).
pub async fn parse_songs_from_paths(
    paths: Vec<String>,
    media_base_url: String,
    on_event: ParseEventSink,
) -> Result<ParsedLibrary, AppError> {
    // One scan at a time, so a rescan never compares against a half-recorded parse.
    let mut known = state().song_dirs.lock().await;
    let allowed_paths = allowed(&state().allowlist, paths);
    parse(&mut known, allowed_paths, &media_base_url, on_event).await
}

/// Re-parses the song folders that changed below the parsed roots among `paths` since the
/// last parse or rescan. Pass every song folder the library has (not only some): which root a
/// nested folder belongs to depends on the others. Parsed roots that aren't among `paths`
/// are forgotten; roots that weren't parsed yet are left to `parse_songs_from_paths`.
pub async fn rescan_songs(paths: Vec<String>, media_base_url: String) -> Result<Rescan, AppError> {
    let mut known = state().song_dirs.lock().await;
    rescan(&mut known, &state().allowlist, paths, &media_base_url).await
}

async fn parse(
    known: &mut KnownSongDirs,
    allowed_paths: Vec<String>,
    media_base_url: &str,
    on_event: ParseEventSink,
) -> Result<ParsedLibrary, AppError> {
    let scans: Vec<RootScan> = scan(allowed_paths)
        .await?
        .into_iter()
        .filter(|scan| !scan.missing)
        .collect();

    let total = scans
        .iter()
        .flat_map(|scan| &scan.dirs)
        .map(|dir| dir.txts.len())
        .sum::<usize>() as u32;
    on_event(ParseEvent::Start { total });

    let jobs = scans.iter().map(|scan| jobs_for(&scan.dirs)).collect();
    let parsed = parse_txts(jobs, media_base_url, total, Some(on_event)).await;

    for scan in &scans {
        let dirs = scan
            .dirs
            .iter()
            .map(|dir| (dir.dir.clone(), dir.fingerprint))
            .collect();
        known.roots.insert(
            scan.root.clone(),
            KnownRoot {
                dirs,
                unsettled: HashMap::new(),
            },
        );
    }

    Ok(pack(
        scans.into_iter().map(|scan| scan.root).zip(parsed),
        |path, songs| SongGroup { path, songs },
    ))
}

async fn rescan(
    known: &mut KnownSongDirs,
    allowlist: &PathAllowlist,
    paths: Vec<String>,
    media_base_url: &str,
) -> Result<Rescan, AppError> {
    known.roots.retain(|root, _| paths.contains(root));
    if known.roots.is_empty() {
        return Ok(Rescan::default());
    }
    // A root that is gone can't be resolved, so it isn't "allowed" either.
    let allowed_paths = allowed(allowlist, paths);

    let mut rescan = Rescan {
        missing_roots: known
            .roots
            .keys()
            .filter(|root| !allowed_paths.contains(root))
            .cloned()
            .collect(),
        ..Default::default()
    };

    let scans = scan(allowed_paths).await?;

    let mut removed = Vec::new();
    let mut changed = Vec::new();
    for scan in &scans {
        let Some(old) = known.roots.get_mut(&scan.root) else {
            continue;
        };
        // An empty root that had songs is most likely an unmounted drive's mount point.
        if scan.missing || (scan.empty && !old.dirs.is_empty()) {
            rescan.missing_roots.push(scan.root.clone());
            continue;
        }

        let present: HashSet<&str> = scan.dirs.iter().map(|dir| dir.dir.as_str()).collect();
        for dir in old.dirs.keys() {
            // Below a folder that couldn't be read this time: unknown, not gone.
            let unknown = scan
                .unreadable
                .iter()
                .any(|unreadable| Path::new(dir).starts_with(unreadable));
            if !present.contains(dir.as_str()) && !unknown {
                removed.push((scan.root.clone(), dir.clone()));
            }
        }

        let mut unsettled = HashMap::new();
        for dir in &scan.dirs {
            if old.dirs.get(&dir.dir) == Some(&dir.fingerprint) {
                continue;
            }
            if old.unsettled.get(&dir.dir) == Some(&dir.fingerprint) {
                changed.push((scan.root.clone(), dir));
            } else {
                unsettled.insert(dir.dir.clone(), dir.fingerprint);
                rescan.pending = true;
            }
        }
        old.unsettled = unsettled;
    }

    if removed.is_empty() && changed.is_empty() {
        return Ok(rescan);
    }

    let jobs = changed.iter().map(|(_, dir)| jobs_for([*dir])).collect();
    let total = changed.iter().map(|(_, dir)| dir.txts.len()).sum::<usize>() as u32;
    let parsed = parse_txts(jobs, media_base_url, total, None).await;

    for (root, dir) in &removed {
        if let Some(known_root) = known.roots.get_mut(root) {
            known_root.dirs.remove(dir);
        }
        log::info!("Song folder removed: {}", dir);
    }
    for (root, dir) in &changed {
        if let Some(known_root) = known.roots.get_mut(root) {
            known_root.dirs.insert(dir.dir.clone(), dir.fingerprint);
        }
        log::info!("Song folder changed: {}", dir.dir);
    }

    let groups = changed
        .iter()
        .map(|(root, dir)| (root.clone(), dir.dir.clone()))
        .zip(parsed)
        .chain(removed.into_iter().map(|key| (key, Vec::new())));
    rescan.changes = pack(groups, |(root, dir), songs| SongDirGroup {
        root,
        dir,
        songs,
    });
    Ok(rescan)
}

/// The paths inside a granted song folder; the others are left out. A folder that is gone (an
/// unplugged drive, looked for again on every rescan) is expected and only logged for debugging.
fn allowed(allowlist: &PathAllowlist, paths: Vec<String>) -> Vec<String> {
    paths
        .into_iter()
        .filter(|path| {
            if allowlist.is_allowed(path) {
                return true;
            }
            if Path::new(path).exists() {
                log::warn!("Skipping disallowed path: {}", path);
            } else {
                log::debug!("Skipping song folder that is gone: {}", path);
            }
            false
        })
        .collect()
}

async fn scan(roots: Vec<String>) -> Result<Vec<RootScan>, AppError> {
    task::spawn_blocking(move || scan_roots(&roots))
        .await
        .map_err(|e| AppError::IoError(e.to_string()))
}

/// One parse job per song file of the given folders.
fn jobs_for<'a>(dirs: impl IntoIterator<Item = &'a SongDir>) -> Vec<ParseJob> {
    dirs.into_iter()
        .flat_map(|dir| {
            let song_dir: Arc<str> = dir.dir.as_str().into();
            dir.txts.iter().map(move |txt| ParseJob {
                txt: txt.clone(),
                song_dir: song_dir.clone(),
                files: dir.files.clone(),
            })
        })
        .collect()
}

#[derive(Clone)]
struct ParseJob {
    txt: String,
    song_dir: Arc<str>,
    files: Arc<Vec<FileEntry>>,
}

type ParsedSong = (LocalSong, Vec<u8>);

/// Parses the song files of each group in parallel, keeping their order. Files that fail to
/// parse are logged and left out.
async fn parse_txts(
    groups: Vec<Vec<ParseJob>>,
    media_base_url: &str,
    total: u32,
    on_event: Option<ParseEventSink>,
) -> Vec<Vec<ParsedSong>> {
    let mut parsed: Vec<Vec<ParsedSong>> = groups.iter().map(|_| Vec::new()).collect();
    let jobs: Vec<(usize, ParseJob)> = groups
        .into_iter()
        .enumerate()
        .flat_map(|(group, jobs)| jobs.into_iter().map(move |job| (group, job)))
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

            for (
                group,
                ParseJob {
                    txt,
                    song_dir,
                    files,
                },
            ) in batch
            {
                match parse_local_txt_file(&txt, &song_dir, &files, &media_base_url) {
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

/// Builds each group from its songs with `build`, moving their notes into one buffer.
fn pack<K, G>(
    groups: impl IntoIterator<Item = (K, Vec<ParsedSong>)>,
    build: impl Fn(K, Vec<LocalSong>) -> G,
) -> PackedSongs<G> {
    let mut packed = PackedSongs::default();
    for (key, parsed) in groups {
        let mut songs = Vec::with_capacity(parsed.len());
        for (song, notes) in parsed {
            packed
                .note_ranges
                .extend([packed.notes.len() as u32, notes.len() as u32]);
            packed.notes.extend_from_slice(&notes);
            songs.push(song);
        }
        packed.groups.push(build(key, songs));
    }
    packed
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

    /// A song folder below its own temp root, parsed into its own state.
    struct Library {
        base: PathBuf,
        root: String,
        allowlist: PathAllowlist,
        known: KnownSongDirs,
    }

    impl Library {
        async fn new(name: &str, songs: &[&str]) -> Self {
            let base =
                std::env::temp_dir().join(format!("tp-rescan-{name}-{}", std::process::id()));
            let _ = fs::remove_dir_all(&base);
            fs::create_dir_all(&base).unwrap();
            for title in songs {
                song(&base, title);
            }
            let root = base.to_string_lossy().to_string();
            let allowlist = PathAllowlist::default();
            assert!(allowlist.allow_directory(&root));
            let mut library = Self {
                base,
                root,
                allowlist,
                known: KnownSongDirs::default(),
            };
            library.parse().await;
            library
        }

        async fn parse(&mut self) -> ParsedLibrary {
            parse(
                &mut self.known,
                vec![self.root.clone()],
                "media://x",
                Arc::new(|_| {}),
            )
            .await
            .unwrap()
        }

        async fn rescan(&mut self) -> Rescan {
            rescan(
                &mut self.known,
                &self.allowlist,
                vec![self.root.clone()],
                "media://x",
            )
            .await
            .unwrap()
        }
    }

    impl Drop for Library {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.base);
            let _ = fs::remove_dir_all(self.base.with_extension("away"));
        }
    }

    fn song(base: &Path, title: &str) {
        let dir = base.join(title);
        fs::create_dir_all(&dir).unwrap();
        fs::write(dir.join("song.txt"), SONG.replace("Title", title)).unwrap();
        fs::write(dir.join("song.mp3"), "").unwrap();
    }

    /// Changed folders by name, with their songs' titles.
    fn changes(rescan: &Rescan) -> Vec<(String, Vec<String>)> {
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

    fn titled(name: &str, titles: &[&str]) -> (String, Vec<String>) {
        (
            name.to_string(),
            titles.iter().map(|t| t.to_string()).collect(),
        )
    }

    #[tokio::test]
    async fn nothing_changed_means_nothing_to_parse() {
        let mut library = Library::new("unchanged", &["a", "b"]).await;
        let rescan = library.rescan().await;
        assert!(rescan.changes.groups.is_empty());
        assert!(!rescan.pending);
        assert!(rescan.missing_roots.is_empty());
    }

    #[tokio::test]
    async fn changes_are_parsed_once_they_look_the_same_twice() {
        let mut library = Library::new("settle", &["a", "b"]).await;
        song(&library.base, "c");
        fs::write(library.base.join("a/song.txt"), SONG.replace("Title", "a2")).unwrap();

        let first = library.rescan().await;
        assert!(first.pending);
        assert!(first.changes.groups.is_empty());

        let second = library.rescan().await;
        assert!(!second.pending);
        assert_eq!(
            changes(&second),
            [titled("a", &["a2"]), titled("c", &["c"])]
        );
        assert_eq!(second.changes.note_ranges.len(), 4);
        // Songs name their folder exactly as the change does.
        for group in &second.changes.groups {
            assert!(group.songs.iter().all(|song| song.song_dir == group.dir));
        }
        assert!(library.rescan().await.changes.groups.is_empty());
    }

    #[tokio::test]
    async fn a_folder_still_changing_waits() {
        let mut library = Library::new("copying", &["a"]).await;
        fs::write(library.base.join("a/song.mp3"), "part").unwrap();
        assert!(library.rescan().await.pending);
        fs::write(library.base.join("a/song.mp3"), "partial").unwrap();
        let rescan = library.rescan().await;
        assert!(rescan.pending);
        assert!(rescan.changes.groups.is_empty());
    }

    #[tokio::test]
    async fn removed_folders_are_reported_right_away() {
        let mut library = Library::new("removed", &["a", "b"]).await;
        fs::remove_dir_all(library.base.join("b")).unwrap();
        assert_eq!(changes(&library.rescan().await), [titled("b", &[])]);
    }

    #[tokio::test]
    async fn a_root_that_is_gone_keeps_its_songs() {
        let mut library = Library::new("gone", &["a"]).await;
        let away = library.base.with_extension("away");
        fs::rename(&library.base, &away).unwrap();
        let rescan = library.rescan().await;
        assert_eq!(rescan.missing_roots, std::slice::from_ref(&library.root));
        assert!(rescan.changes.groups.is_empty());

        fs::rename(&away, &library.base).unwrap();
        let back = library.rescan().await;
        assert!(back.missing_roots.is_empty());
        assert!(back.changes.groups.is_empty());
    }

    #[tokio::test]
    async fn an_emptied_root_counts_as_unmounted() {
        let mut library = Library::new("unmounted", &["a"]).await;
        fs::remove_dir_all(library.base.join("a")).unwrap();
        let rescan = library.rescan().await;
        assert_eq!(rescan.missing_roots, std::slice::from_ref(&library.root));
        assert!(rescan.changes.groups.is_empty());
    }

    #[tokio::test]
    async fn roots_left_out_are_forgotten() {
        let mut library = Library::new("forgotten", &["a"]).await;
        let rescan = rescan(&mut library.known, &library.allowlist, vec![], "media://x")
            .await
            .unwrap();
        assert!(rescan.changes.groups.is_empty());
        assert!(library.known.roots.is_empty());
    }

    #[cfg(unix)]
    #[tokio::test]
    async fn an_unreadable_root_is_left_out_of_a_parse() {
        use std::os::unix::fs::PermissionsExt;
        let mut library = Library::new("unreadable", &["a"]).await;
        library.known = KnownSongDirs::default();
        fs::set_permissions(&library.base, fs::Permissions::from_mode(0o000)).unwrap();
        let parsed = library.parse().await;
        fs::set_permissions(&library.base, fs::Permissions::from_mode(0o755)).unwrap();
        assert!(parsed.groups.is_empty());
        assert!(library.known.roots.is_empty());
    }

    #[tokio::test]
    async fn songs_right_in_a_root_with_a_trailing_slash_name_its_folder() {
        let mut library = Library::new("slash", &[]).await;
        fs::write(library.base.join("song.txt"), SONG).unwrap();
        fs::write(library.base.join("song.mp3"), "").unwrap();
        library.root = format!("{}/", library.root);
        let parsed = library.parse().await;
        let song = &parsed.groups[0].songs[0];
        fs::remove_file(library.base.join("song.txt")).unwrap();
        let rescan = library.rescan().await;
        assert_eq!(rescan.changes.groups[0].dir, song.song_dir);
    }
}
