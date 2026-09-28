use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::state::state;
use crate::usdb::models::{UsdbSearchEntry, UsdbSong, UsdbSongPreview};

/// Reported after each catalog page is fetched so the UI can show sync progress.
#[derive(Serialize, Deserialize, Debug, Clone, specta::Type)]
pub struct UsdbSyncProgressEvent {
    pub fetched: u32,
    pub total: u32,
}

pub type UsdbProgressSink = dyn Fn(UsdbSyncProgressEvent) + Send + Sync;

pub async fn usdb_login(username: String, password: String) -> Result<bool, AppError> {
    let mut client = crate::usdb::client::UsdbClient::new();
    let success = client.login(&username, &password).await?;

    if success {
        let mut usdb = state().usdb_client.lock().await;
        *usdb = Some(client);
    }

    Ok(success)
}

pub async fn usdb_logout() -> Result<(), AppError> {
    let mut usdb = state().usdb_client.lock().await;

    if let Some(ref mut client) = *usdb {
        client.logout().await?;
    }

    *usdb = None;
    Ok(())
}

pub async fn usdb_is_logged_in() -> Result<bool, AppError> {
    let usdb = state().usdb_client.lock().await;

    match &*usdb {
        Some(client) => client.is_logged_in().await,
        None => Ok(false),
    }
}

/// Full fetch if `last_mtime == 0`, otherwise incremental sync from the watermark.
pub async fn usdb_fetch_catalog(
    on_progress: &UsdbProgressSink,
    last_mtime: i32,
    last_song_ids: Vec<u32>,
) -> Result<Vec<UsdbSearchEntry>, AppError> {
    // Clone + drop lock so other commands aren't blocked during the long fetch
    let client = {
        let usdb = state().usdb_client.lock().await;
        usdb.as_ref()
            .ok_or_else(|| AppError::UsdbError("Not logged in to USDB".to_string()))?
            .clone()
    };

    if last_mtime == 0 {
        client.fetch_all_songs(on_progress).await
    } else {
        client
            .fetch_updated_songs(on_progress, last_mtime, &last_song_ids)
            .await
    }
}

pub async fn usdb_get_song_preview(song_id: u32) -> Result<UsdbSongPreview, AppError> {
    let client = {
        let usdb = state().usdb_client.lock().await;
        usdb.as_ref()
            .ok_or_else(|| AppError::UsdbError("Not logged in to USDB".to_string()))?
            .clone()
    };

    client.get_song_preview(song_id).await
}

pub async fn usdb_get_song(song_id: u32) -> Result<UsdbSong, AppError> {
    let client = {
        let usdb = state().usdb_client.lock().await;
        usdb.as_ref()
            .ok_or_else(|| AppError::UsdbError("Not logged in to USDB".to_string()))?
            .clone()
    };

    client.get_song(song_id).await
}
