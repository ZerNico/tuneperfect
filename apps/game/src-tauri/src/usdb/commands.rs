use tauri::State;

use crate::error::AppError;
use crate::usdb::models::{UsdbSearchEntry, UsdbSong, UsdbSongPreview};
use crate::AppState;

#[tauri::command]
#[specta::specta]
pub async fn usdb_login(
    state: State<'_, AppState>,
    username: String,
    password: String,
) -> Result<bool, AppError> {
    let mut client = crate::usdb::client::UsdbClient::new();
    let success = client.login(&username, &password).await?;

    if success {
        let mut usdb = state.usdb_client.lock().await;
        *usdb = Some(client);
    }

    Ok(success)
}

#[tauri::command]
#[specta::specta]
pub async fn usdb_logout(state: State<'_, AppState>) -> Result<(), AppError> {
    let mut usdb = state.usdb_client.lock().await;

    if let Some(ref mut client) = *usdb {
        client.logout().await?;
    }

    *usdb = None;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn usdb_is_logged_in(state: State<'_, AppState>) -> Result<bool, AppError> {
    let usdb = state.usdb_client.lock().await;

    match &*usdb {
        Some(client) => client.is_logged_in().await,
        None => Ok(false),
    }
}

/// Full fetch if `last_mtime == 0`, otherwise incremental sync from the watermark.
#[tauri::command]
#[specta::specta]
pub async fn usdb_fetch_catalog(
    state: State<'_, AppState>,
    last_mtime: i32,
    last_song_ids: Vec<u32>,
) -> Result<Vec<UsdbSearchEntry>, AppError> {
    // Clone + drop lock so other commands aren't blocked during the long fetch
    let client = {
        let usdb = state.usdb_client.lock().await;
        usdb.as_ref()
            .ok_or_else(|| AppError::UsdbError("Not logged in to USDB".to_string()))?
            .clone()
    };

    if last_mtime == 0 {
        client.fetch_all_songs().await
    } else {
        client.fetch_updated_songs(last_mtime, &last_song_ids).await
    }
}

#[tauri::command]
#[specta::specta]
pub async fn usdb_get_song_preview(
    state: State<'_, AppState>,
    song_id: u32,
) -> Result<UsdbSongPreview, AppError> {
    let client = {
        let usdb = state.usdb_client.lock().await;
        usdb.as_ref()
            .ok_or_else(|| AppError::UsdbError("Not logged in to USDB".to_string()))?
            .clone()
    };

    client.get_song_preview(song_id).await
}

#[tauri::command]
#[specta::specta]
pub async fn usdb_get_song(
    state: State<'_, AppState>,
    song_id: u32,
) -> Result<UsdbSong, AppError> {
    let client = {
        let usdb = state.usdb_client.lock().await;
        usdb.as_ref()
            .ok_or_else(|| AppError::UsdbError("Not logged in to USDB".to_string()))?
            .clone()
    };

    client.get_song(song_id).await
}
