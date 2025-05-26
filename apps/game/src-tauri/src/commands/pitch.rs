use crate::{
    audio::recorder::{MicrophoneOptions, Recorder},
    error::AppError,
    AppState,
};
use tauri::{AppHandle, Manager, State};

#[tauri::command]
#[specta::specta]
pub fn start_recording(
    app_handle: AppHandle,
    options: Vec<MicrophoneOptions>,
    samples_per_beat: i32,
) -> Result<(), AppError> {
    let state = app_handle.state::<AppState>();
    let mut recorder = state.recorder.write().unwrap();

    if recorder.is_some() {
        let mut processors = state.processors.write().unwrap();
        processors.clear();

        recorder.take();
    }

    *recorder = Some(Recorder::new(
        app_handle.clone(),
        options,
        samples_per_beat as usize,
    )?);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn stop_recording(state: State<'_, AppState>) -> Result<(), AppError> {
    let mut recorder = state.recorder.write().unwrap();

    if recorder.is_none() {
        return Err(AppError::RecorderError("recorder not started".to_string()));
    }

    let mut processors = state.processors.write().unwrap();
    processors.clear();

    recorder.take();
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn get_pitch(state: State<'_, AppState>, index: i32) -> Result<f32, AppError> {
    let processors = state.processors.read().unwrap();

    let processor = processors
        .get(&(index as usize))
        .ok_or(AppError::ProcessorError("processor not found".to_string()))?;
    let mut processor = processor.lock().unwrap();
    let pitch = processor.get_pitch();

    Ok(pitch)
}
