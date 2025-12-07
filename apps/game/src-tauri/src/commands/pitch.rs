use crate::{
    audio::{MicrophoneOptions, recorder::Recorder},
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
    playback_enabled: bool,
    playback_volume: f32,
) -> Result<(), AppError> {
    let state = app_handle.state::<AppState>();
    let mut recorder = state.recorder.write()
        .map_err(|_| AppError::RecorderError("Failed to acquire recorder lock".to_string()))?;

    if recorder.is_some() {
        let mut processors = state.processors.write()
            .map_err(|_| AppError::ProcessorError("Failed to acquire processors lock".to_string()))?;
        processors.clear();

        recorder.take();
    }

    *recorder = Some(Recorder::new(
        app_handle.clone(),
        options,
        samples_per_beat as usize,
        playback_enabled,
        playback_volume,
    )?);
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn stop_recording(state: State<'_, AppState>) -> Result<(), AppError> {
    let mut recorder = state.recorder.write()
        .map_err(|_| AppError::RecorderError("Failed to acquire recorder lock".to_string()))?;

    if recorder.is_none() {
        return Err(AppError::RecorderError("recorder not started".to_string()));
    }

    let mut processors = state.processors.write()
        .map_err(|_| AppError::ProcessorError("Failed to acquire processors lock".to_string()))?;
    processors.clear();

    recorder.take();
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn get_pitch(state: State<'_, AppState>, index: i32) -> Result<f32, AppError> {
    let processors = state.processors.read()
        .map_err(|_| AppError::ProcessorError("Failed to acquire processors lock".to_string()))?;

    let processor = processors
        .get(&(index as usize))
        .ok_or(AppError::ProcessorError("processor not found".to_string()))?;
    
    let pitch = match processor.lock() {
        Ok(mut processor) => processor.get_pitch(),
        Err(poisoned) => {
            // Handle poisoned mutex by recovering the data
            eprintln!("Mutex poisoned for processor {}, attempting recovery during pitch read", index);
            let mut processor = poisoned.into_inner();
            processor.get_pitch()
        }
    };

    Ok(pitch)
}
