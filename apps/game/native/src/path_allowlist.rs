use std::path::{Path, PathBuf};
use std::sync::RwLock;

use crate::local_server::PathPolicy;

/// Directories the user has granted access to, the replacement for Tauri's fs scope.
///
/// Both sides of a check are canonicalized, so `..` segments and symlinks resolve to where
/// they really point before the prefix comparison; a path escaping a granted folder that
/// way is rejected.
#[derive(Default)]
pub struct PathAllowlist {
    roots: RwLock<Vec<PathBuf>>,
}

impl PathAllowlist {
    /// Grants access to `path` and everything below it. Returns `false` if the directory
    /// doesn't exist.
    pub fn allow_directory(&self, path: &str) -> bool {
        let Ok(root) = dunce::canonicalize(path) else {
            return false;
        };

        let mut roots = self
            .roots
            .write()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        if !roots.contains(&root) {
            roots.push(root);
        }
        true
    }

    pub fn is_allowed(&self, path: &str) -> bool {
        let Ok(path) = dunce::canonicalize(Path::new(path)) else {
            return false;
        };

        let roots = self
            .roots
            .read()
            .unwrap_or_else(|poisoned| poisoned.into_inner());
        roots.iter().any(|root| path.starts_with(root))
    }
}

impl PathPolicy for PathAllowlist {
    fn is_allowed(&self, path: &str) -> bool {
        PathAllowlist::is_allowed(self, path)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_tree() -> PathBuf {
        let root = std::env::temp_dir().join(format!("tp-allowlist-{}", std::process::id()));
        std::fs::create_dir_all(root.join("songs/artist")).unwrap();
        std::fs::create_dir_all(root.join("private")).unwrap();
        std::fs::write(root.join("songs/artist/song.txt"), "").unwrap();
        std::fs::write(root.join("private/secret.txt"), "").unwrap();
        root
    }

    #[test]
    fn allows_files_below_a_granted_directory() {
        let root = temp_tree();
        let allowlist = PathAllowlist::default();
        assert!(allowlist.allow_directory(root.join("songs").to_str().unwrap()));

        assert!(allowlist.is_allowed(root.join("songs/artist/song.txt").to_str().unwrap()));
        assert!(!allowlist.is_allowed(root.join("private/secret.txt").to_str().unwrap()));
    }

    #[test]
    fn rejects_dot_dot_escapes() {
        let root = temp_tree();
        let allowlist = PathAllowlist::default();
        allowlist.allow_directory(root.join("songs").to_str().unwrap());

        let escape = root.join("songs/artist/../../private/secret.txt");
        assert!(!allowlist.is_allowed(escape.to_str().unwrap()));
    }

    #[test]
    fn rejects_missing_directories_and_paths() {
        let root = temp_tree();
        let allowlist = PathAllowlist::default();
        assert!(!allowlist.allow_directory(root.join("missing").to_str().unwrap()));
        assert!(!allowlist.is_allowed(root.join("songs/nope.txt").to_str().unwrap()));
    }
}
