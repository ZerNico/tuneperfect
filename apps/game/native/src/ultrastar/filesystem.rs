use std::{
    collections::HashSet,
    fs,
    hash::{DefaultHasher, Hash, Hasher},
    path::{Path, PathBuf},
    sync::Arc,
    time::{SystemTime, UNIX_EPOCH},
};

#[derive(Debug, Clone)]
pub struct FileEntry {
    pub path: String,
    pub filename: String,
}

/// A folder with song files in it, and everything next to them (shared by all its song files).
#[derive(Debug, Clone)]
pub struct SongDir {
    pub dir: String,
    pub txts: Vec<String>,
    pub files: Arc<Vec<FileEntry>>,
    /// Changes whenever a file in the folder is added, removed, renamed, resized or rewritten.
    pub fingerprint: u64,
    /// The newest modification time of its files, to tell a folder that is still being copied.
    pub newest_change: Option<SystemTime>,
}

/// One root's song folders, in the order they were found.
#[derive(Debug, Clone, Default)]
pub struct RootScan {
    pub root: String,
    pub dirs: Vec<SongDir>,
    /// Folders below the root that couldn't be read: what was in them is unknown, not gone.
    pub unreadable: Vec<String>,
    /// The root itself doesn't exist or can't be read (e.g. an unplugged drive).
    pub missing: bool,
}

/// The song folders below each root, in the order the roots were given.
///
/// - A folder that can't be read is logged and skipped, so one bad folder doesn't empty the library.
/// - Every folder is visited once (by its canonical path): symlink loops end, and a root nested in
///   another root keeps its own songs instead of having them parsed twice.
pub fn scan_roots(roots: &[String]) -> Vec<RootScan> {
    let root_dirs: HashSet<PathBuf> = roots
        .iter()
        .filter_map(|root| fs::canonicalize(root).ok())
        .collect();
    let mut visited = HashSet::new();

    roots
        .iter()
        .map(|root| {
            let mut scan = RootScan {
                root: root.clone(),
                ..Default::default()
            };
            let path = Path::new(root);
            if path.is_dir() {
                let own = fs::canonicalize(path).ok();
                if own.is_none() || fs::read_dir(path).is_err() {
                    scan.missing = true;
                } else {
                    collect(path, own.as_deref(), &root_dirs, &mut visited, &mut scan);
                }
            } else if path.is_file() && is_txt(path) {
                // A song file given directly.
                if let Some(parent) = path.parent() {
                    let files = list_files(parent);
                    scan.dirs.push(song_dir(parent, vec![root.clone()], files));
                }
            } else {
                scan.missing = true;
            }
            scan
        })
        .collect()
}

fn is_txt(path: &Path) -> bool {
    path.extension()
        .is_some_and(|ext| ext.eq_ignore_ascii_case("txt"))
}

fn collect(
    dir: &Path,
    own_root: Option<&Path>,
    root_dirs: &HashSet<PathBuf>,
    visited: &mut HashSet<PathBuf>,
    scan: &mut RootScan,
) {
    let canonical = match fs::canonicalize(dir) {
        Ok(path) => path,
        Err(e) => {
            log::warn!("Skipping folder '{}': {}", dir.display(), e);
            scan.unreadable.push(dir.to_string_lossy().to_string());
            return;
        }
    };
    if !visited.insert(canonical) {
        return;
    }

    let entries = match fs::read_dir(dir) {
        Ok(entries) => entries,
        Err(e) => {
            log::warn!("Skipping folder '{}': {}", dir.display(), e);
            scan.unreadable.push(dir.to_string_lossy().to_string());
            return;
        }
    };

    let mut files = Vec::new();
    let mut txts = Vec::new();
    let mut subdirs = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        let Ok(file_type) = entry.file_type() else {
            continue;
        };
        // `file_type` doesn't follow symlinks; for those, look at what they point to (and skip
        // broken ones).
        let (is_dir, is_file) = if file_type.is_symlink() {
            (path.is_dir(), path.is_file())
        } else {
            (file_type.is_dir(), file_type.is_file())
        };

        if is_dir {
            subdirs.push(path);
        } else if is_file {
            if is_txt(&path) {
                txts.push(path.to_string_lossy().to_string());
            }
            files.push(FileEntry {
                filename: entry.file_name().to_string_lossy().to_string(),
                path: path.to_string_lossy().to_string(),
            });
        }
    }

    if !txts.is_empty() {
        scan.dirs.push(song_dir(dir, txts, files));
    }

    for subdir in subdirs {
        // Another root's folder belongs to that root.
        let is_other_root = fs::canonicalize(&subdir)
            .map(|canonical| {
                root_dirs.contains(&canonical) && Some(canonical.as_path()) != own_root
            })
            .unwrap_or(false);
        if !is_other_root {
            collect(&subdir, own_root, root_dirs, visited, scan);
        }
    }
}

/// Fingerprints the folder's files by name, size and modification time. Hidden files (like
/// `.DS_Store`, which changes whenever Finder shows the folder) don't count.
fn song_dir(dir: &Path, mut txts: Vec<String>, mut files: Vec<FileEntry>) -> SongDir {
    txts.sort();
    files.sort_by(|a, b| a.filename.cmp(&b.filename));

    let mut hasher = DefaultHasher::new();
    let mut newest_change = None;
    for file in files.iter().filter(|file| !file.filename.starts_with('.')) {
        file.filename.hash(&mut hasher);
        // Follows symlinks, so a replaced target counts as a change.
        match fs::metadata(&file.path) {
            Ok(metadata) => {
                metadata.len().hash(&mut hasher);
                let modified = metadata.modified().ok();
                modified
                    .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
                    .map(|duration| duration.as_nanos())
                    .hash(&mut hasher);
                if modified > newest_change {
                    newest_change = modified;
                }
            }
            Err(_) => 0u8.hash(&mut hasher),
        }
    }

    SongDir {
        dir: dir.to_string_lossy().to_string(),
        txts,
        files: Arc::new(files),
        fingerprint: hasher.finish(),
        newest_change,
    }
}

fn list_files(dir: &Path) -> Vec<FileEntry> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };
    entries
        .flatten()
        .filter(|entry| entry.path().is_file())
        .map(|entry| FileEntry {
            filename: entry.file_name().to_string_lossy().to_string(),
            path: entry.path().to_string_lossy().to_string(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_root(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("tp-fs-test-{name}-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    fn song(dir: &Path, name: &str) {
        fs::create_dir_all(dir).unwrap();
        fs::write(dir.join(format!("{name}.txt")), "#TITLE:x").unwrap();
        fs::write(dir.join(format!("{name}.mp3")), "").unwrap();
    }

    fn names(scan: &RootScan) -> Vec<String> {
        let mut names: Vec<_> = scan
            .dirs
            .iter()
            .flat_map(|dir| &dir.txts)
            .map(|txt| {
                Path::new(txt)
                    .file_name()
                    .unwrap()
                    .to_string_lossy()
                    .to_string()
            })
            .collect();
        names.sort();
        names
    }

    #[test]
    fn nested_roots_keep_their_own_songs_and_prefixes_dont_match() {
        let base = temp_root("nested");
        song(&base.join("Songs/a"), "a");
        song(&base.join("Songs/inner/b"), "b");
        song(&base.join("Songs2/c"), "c");
        let roots: Vec<String> = ["Songs", "Songs/inner", "Songs2"]
            .iter()
            .map(|r| base.join(r).to_string_lossy().to_string())
            .collect();

        let found = scan_roots(&roots);
        assert_eq!(names(&found[0]), ["a.txt"]);
        assert_eq!(names(&found[1]), ["b.txt"]);
        assert_eq!(names(&found[2]), ["c.txt"]);
        // Files next to a song are listed once and shared.
        assert_eq!(found[0].dirs[0].files.len(), 2);
        let _ = fs::remove_dir_all(base);
    }

    #[cfg(unix)]
    #[test]
    fn symlink_loops_end_and_unreadable_folders_are_skipped() {
        use std::os::unix::fs::PermissionsExt;
        let base = temp_root("loops");
        song(&base.join("a"), "a");
        std::os::unix::fs::symlink(&base, base.join("a/loop")).unwrap();
        let locked = base.join("locked");
        song(&locked, "hidden");
        fs::set_permissions(&locked, fs::Permissions::from_mode(0o000)).unwrap();

        let found = scan_roots(&[base.to_string_lossy().to_string()]);
        fs::set_permissions(&locked, fs::Permissions::from_mode(0o755)).unwrap();
        assert_eq!(names(&found[0]), ["a.txt"]);
        assert_eq!(found[0].unreadable, [locked.to_string_lossy().to_string()]);
        let _ = fs::remove_dir_all(base);
    }

    fn fingerprint(root: &Path, dir: &str) -> u64 {
        scan_roots(&[root.to_string_lossy().to_string()])[0]
            .dirs
            .iter()
            .find(|d| d.dir.ends_with(dir))
            .unwrap()
            .fingerprint
    }

    #[test]
    fn fingerprint_changes_with_the_files_but_not_hidden_ones() {
        let base = temp_root("fingerprint");
        song(&base.join("a"), "a");
        let initial = fingerprint(&base, "a");
        assert_eq!(fingerprint(&base, "a"), initial);

        fs::write(base.join("a/.DS_Store"), "x").unwrap();
        assert_eq!(fingerprint(&base, "a"), initial);

        fs::write(base.join("a/cover.jpg"), "x").unwrap();
        let with_cover = fingerprint(&base, "a");
        assert_ne!(with_cover, initial);

        fs::write(base.join("a/a.mp3"), "longer").unwrap();
        assert_ne!(fingerprint(&base, "a"), with_cover);
        let _ = fs::remove_dir_all(base);
    }

    #[test]
    fn missing_roots_are_reported() {
        let base = temp_root("missing");
        let gone = base.join("gone").to_string_lossy().to_string();
        let found = scan_roots(&[gone]);
        assert!(found[0].missing);
        assert!(found[0].dirs.is_empty());
        let _ = fs::remove_dir_all(base);
    }
}
