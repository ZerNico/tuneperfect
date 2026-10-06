use std::{
    collections::HashSet,
    fs,
    path::{Path, PathBuf},
    sync::Arc,
};

#[derive(Debug, Clone)]
pub struct FileEntry {
    pub path: String,
    pub filename: String,
}

/// A song file and everything next to it (shared by all song files in that folder).
#[derive(Debug, Clone)]
pub struct TxtFile {
    pub path: String,
    pub files: Arc<Vec<FileEntry>>,
}

/// The song files below each root, in the order the roots were given.
///
/// - A folder that can't be read is logged and skipped, so one bad folder doesn't empty the library.
/// - Every folder is visited once (by its canonical path): symlink loops end, and a root nested in
///   another root keeps its own songs instead of having them parsed twice.
pub fn find_txt_files_by_root(roots: &[String]) -> Vec<(String, Vec<TxtFile>)> {
    let root_dirs: HashSet<PathBuf> = roots
        .iter()
        .filter_map(|root| fs::canonicalize(root).ok())
        .collect();
    let mut visited = HashSet::new();

    roots
        .iter()
        .map(|root| {
            let mut found = Vec::new();
            let path = Path::new(root);
            if path.is_dir() {
                let own = fs::canonicalize(path).ok();
                collect(path, own.as_deref(), &root_dirs, &mut visited, &mut found);
            } else if path.is_file() && is_txt(path) {
                // A song file given directly.
                if let Some(parent) = path.parent() {
                    found.push(TxtFile {
                        path: root.clone(),
                        files: Arc::new(list_files(parent)),
                    });
                }
            }
            (root.clone(), found)
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
    found: &mut Vec<TxtFile>,
) {
    let canonical = match fs::canonicalize(dir) {
        Ok(path) => path,
        Err(e) => {
            log::warn!("Skipping folder '{}': {}", dir.display(), e);
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
        let files = Arc::new(files);
        found.extend(txts.into_iter().map(|path| TxtFile {
            path,
            files: files.clone(),
        }));
    }

    for subdir in subdirs {
        // Another root's folder belongs to that root.
        let is_other_root = fs::canonicalize(&subdir)
            .map(|canonical| {
                root_dirs.contains(&canonical) && Some(canonical.as_path()) != own_root
            })
            .unwrap_or(false);
        if !is_other_root {
            collect(&subdir, own_root, root_dirs, visited, found);
        }
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

    fn names(found: &[TxtFile]) -> Vec<String> {
        let mut names: Vec<_> = found
            .iter()
            .map(|t| {
                Path::new(&t.path)
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

        let found = find_txt_files_by_root(&roots);
        assert_eq!(names(&found[0].1), ["a.txt"]);
        assert_eq!(names(&found[1].1), ["b.txt"]);
        assert_eq!(names(&found[2].1), ["c.txt"]);
        // Files next to a song are listed once and shared.
        assert_eq!(found[0].1[0].files.len(), 2);
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

        let found = find_txt_files_by_root(&[base.to_string_lossy().to_string()]);
        fs::set_permissions(&locked, fs::Permissions::from_mode(0o755)).unwrap();
        assert_eq!(names(&found[0].1), ["a.txt"]);
        let _ = fs::remove_dir_all(base);
    }
}
