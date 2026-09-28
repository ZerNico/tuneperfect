//! Moves this Tauri install to the Electron version of the game.
//!
//! Dormant unless the API switch (`TAURI_MIGRATION_ENABLED`) is on for this platform or the
//! app was started with `--enable-migration`. The Electron build comes from the API's
//! Electron update route and goes through the Tauri updater, so it's verified with the same
//! key as every update. The Electron app moves the settings and stores over on first launch
//! (and on Windows removes this install).

use std::time::Duration;

use tauri::{AppHandle, Manager, State, Url};
use tauri_plugin_cli::CliExt;
use tauri_plugin_updater::{Update, UpdaterExt};
use tokio::sync::Mutex;

use crate::error::AppError;

/// The Electron build found by the last check.
#[derive(Default)]
pub struct MigrationState(Mutex<Option<Update>>);

/// The platform name the API uses, the same as the updater's `{{target}}`.
fn target() -> &'static str {
    if cfg!(target_os = "macos") {
        "darwin"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else {
        "linux"
    }
}

/// Only installs the updater can replace: app bundles, AppImages and Windows installs.
/// Linux packages (deb, rpm) never updated in place, so they keep running as they are.
fn installable() -> bool {
    !cfg!(debug_assertions)
        && (!cfg!(target_os = "linux") || std::env::var_os("APPIMAGE").is_some())
}

/// `https://api…/v1.0/updates`, taken from the updater endpoint the release build sets.
fn updates_url(app: &AppHandle) -> Option<String> {
    let endpoint = app
        .config()
        .plugins
        .0
        .get("updater")?
        .get("endpoints")?
        .as_array()?
        .first()?
        .as_str()?;
    let (base, _) = endpoint.split_once("/updates/")?;
    Some(format!("{base}/updates"))
}

fn forced(app: &AppHandle) -> bool {
    app.cli()
        .matches()
        .ok()
        .and_then(|matches| {
            matches
                .args
                .get("enable-migration")
                .map(|arg| arg.occurrences > 0)
        })
        .unwrap_or(false)
}

#[derive(serde::Deserialize)]
struct Switch {
    enabled: bool,
}

async fn enabled(updates_url: &str) -> Result<bool, AppError> {
    let response = reqwest::Client::new()
        .get(format!("{updates_url}/tauri-migration/{}", target()))
        .timeout(Duration::from_secs(10))
        .send()
        .await?
        .error_for_status()?;
    let switch: Switch = serde_json::from_str(&response.text().await?)?;
    Ok(switch.enabled)
}

async fn find_electron_build(app: &AppHandle) -> Result<Option<Update>, AppError> {
    if !installable() {
        return Ok(None);
    }
    let Some(updates_url) = updates_url(app) else {
        return Ok(None);
    };
    if !forced(app) && !enabled(&updates_url).await? {
        return Ok(None);
    }

    let endpoint = Url::parse(&format!(
        "{updates_url}/electron/{{{{target}}}}/{{{{arch}}}}/{{{{current_version}}}}"
    ))
    .map_err(|e| AppError::MigrationError(e.to_string()))?;
    let update = app
        .updater_builder()
        .endpoints(vec![endpoint])?
        // The route only answers with a newer release; any answer is the one to install.
        .version_comparator(|_, _| true)
        .build()?
        .check()
        .await?;
    Ok(update)
}

/// The version of the Electron build to move to, or `None` when migration is off. Failures
/// count as off, so the regular update check still runs.
#[tauri::command]
#[specta::specta]
pub async fn check_migration(
    app: AppHandle,
    state: State<'_, MigrationState>,
) -> Result<Option<String>, AppError> {
    let update = find_electron_build(&app).await.unwrap_or_else(|error| {
        log::warn!("Migration check failed: {error}");
        None
    });
    let version = update.as_ref().map(|update| update.version.clone());
    *state.0.lock().await = update;
    Ok(version)
}

/// Downloads and verifies the Electron build, installs it and starts it. Only returns if
/// something failed.
#[tauri::command]
#[specta::specta]
pub async fn install_migration(
    app: AppHandle,
    state: State<'_, MigrationState>,
) -> Result<(), AppError> {
    let update = state
        .0
        .lock()
        .await
        .take()
        .ok_or_else(|| AppError::MigrationError("no Electron build found".into()))?;
    let bytes = update.download(|_, _| {}, || {}).await?;
    log::info!("Moving to the Electron version {}", update.version);

    // The Electron installer goes to its own directory; the Electron app then removes this
    // install. It's silent and starts the app when it's done.
    #[cfg(target_os = "windows")]
    {
        let dir = std::env::temp_dir().join("tuneperfect-migration");
        std::fs::create_dir_all(&dir)?;
        let setup = dir.join("Tune Perfect Setup.exe");
        std::fs::write(&setup, bytes)?;
        std::process::Command::new(setup)
            .args(["/S", "--force-run"])
            .spawn()?;
        app.exit(0);
        Ok(())
    }

    // The bundle is replaced in place, like with any update. Restarting reads the new
    // bundle's Info.plist, so it finds the Electron binary.
    #[cfg(target_os = "macos")]
    {
        update.install(bytes)?;
        app.restart();
    }

    #[cfg(target_os = "linux")]
    {
        update.install(bytes)?;
        relaunch_appimage()?;
        app.exit(0);
        Ok(())
    }
}

/// Starts the replaced AppImage the way a launcher would. Tauri's restart would hand the
/// Electron app this image's descriptors (the AppImage runtime holds its mount through one)
/// and its environment, keeping the old image mounted for as long as the new app runs.
#[cfg(target_os = "linux")]
fn relaunch_appimage() -> std::io::Result<()> {
    use std::process::{Command, Stdio};

    let appimage = std::env::var_os("APPIMAGE")
        .ok_or_else(|| std::io::Error::other("not running as an AppImage"))?;
    // Bash closes every descriptor above stderr before it starts the new image; `exec {n}>&-`
    // closes descriptors above 9, which dash can't.
    let script = r#"for fd in /proc/$$/fd/*; do n=${fd##*/}; [ "$n" -gt 2 ] && exec {n}>&-; done 2>/dev/null; exec "$@""#;
    let mut command = Command::new("/bin/bash");
    command
        .args(["-c", script, "bash"])
        .arg(appimage)
        .args(std::env::args_os().skip(1))
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null());
    clear_appimage_environment(&mut command);
    command.spawn()?;
    Ok(())
}

/// The AppImage runtime and its GTK hook point variables (GTK_PATH, GIO_MODULE_DIR,
/// GSETTINGS_SCHEMA_DIR, XDG_DATA_DIRS, …) into this image's mount. Once it's unmounted they
/// point nowhere, and GLib aborts without its schemas, so they go: variables into the mount
/// are dropped, path lists keep their other entries. The new image's runtime sets its own.
#[cfg(target_os = "linux")]
fn clear_appimage_environment(command: &mut std::process::Command) {
    use std::os::unix::ffi::OsStrExt;

    for name in ["APPDIR", "APPIMAGE", "ARGV0", "OWD", "GTK_THEME"] {
        command.env_remove(name);
    }
    let Some(appdir) = std::env::var_os("APPDIR") else {
        return;
    };
    let appdir = appdir.as_bytes();
    let inside = |entry: &[u8]| entry.starts_with(appdir);

    for (name, value) in std::env::vars_os() {
        let bytes = value.as_bytes();
        if !bytes.windows(appdir.len()).any(|window| window == appdir) {
            continue;
        }
        let kept: Vec<&[u8]> = bytes
            .split(|&byte| byte == b':')
            .filter(|entry| !entry.is_empty() && !inside(entry))
            .collect();
        if kept.is_empty() {
            command.env_remove(&name);
        } else {
            command.env(&name, std::ffi::OsStr::from_bytes(&kept.join(&b':')));
        }
    }
}

pub fn manage(app: &tauri::App) {
    app.manage(MigrationState::default());
}
