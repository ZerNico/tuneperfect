use super::host::{IceServerConfig, SharedWebRTCHost};
use crate::error::AppError;

#[tauri::command]
#[specta::specta]
pub async fn webrtc_create_answer(
    user_id: String,
    offer_sdp: String,
    ice_servers: Vec<IceServerConfig>,
    app_handle: tauri::AppHandle,
    state: tauri::State<'_, SharedWebRTCHost>,
) -> Result<String, AppError> {
    let mut host = state.lock().await;
    host.create_answer(user_id, offer_sdp, ice_servers, app_handle)
        .await
        .map_err(AppError::WebRTCError)
}

#[tauri::command]
#[specta::specta]
pub async fn webrtc_add_ice_candidate(
    user_id: String,
    candidate: String,
    state: tauri::State<'_, SharedWebRTCHost>,
) -> Result<(), AppError> {
    let peer = {
        let host = state.lock().await;
        host.get_peer(&user_id).map_err(AppError::WebRTCError)?
    };
    peer.add_ice_candidate(&candidate)
        .await
        .map_err(AppError::WebRTCError)
}

#[tauri::command]
#[specta::specta]
pub async fn webrtc_send_message(
    user_id: String,
    label: String,
    data: String,
    state: tauri::State<'_, SharedWebRTCHost>,
) -> Result<(), AppError> {
    let peer = {
        let host = state.lock().await;
        host.get_peer(&user_id).map_err(AppError::WebRTCError)?
    };
    peer.send_message(&label, &data)
        .await
        .map_err(AppError::WebRTCError)
}

#[tauri::command]
#[specta::specta]
pub async fn webrtc_close_connection(
    user_id: String,
    state: tauri::State<'_, SharedWebRTCHost>,
) -> Result<(), AppError> {
    let mut host = state.lock().await;
    host.close_connection(&user_id).await;
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn webrtc_close_all(
    state: tauri::State<'_, SharedWebRTCHost>,
) -> Result<(), AppError> {
    let mut host = state.lock().await;
    host.close_all().await;
    Ok(())
}
