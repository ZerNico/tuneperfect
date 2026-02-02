use crate::{
    audio::{MicrophoneOptions, recorder::Recorder},
    error::AppError,
    AppState,
};
use futures::future::join_all;
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
pub async fn get_pitches(state: State<'_, AppState>) -> Result<Vec<f32>, AppError> {
    let futures = {
        let processors = state.processors.read()
            .map_err(|_| AppError::ProcessorError("Failed to acquire processors lock".to_string()))?;

        let mut processor_refs: Vec<_> = Vec::new();
        let mut index = 0;
        while let Some(processor) = processors.get(&index) {
            processor_refs.push((index, processor.clone()));
            index += 1;
        }

        processor_refs
            .into_iter()
            .map(|(idx, processor)| {
                tokio::task::spawn_blocking(move || {
                    match processor.lock() {
                        Ok(mut p) => (idx, p.get_pitch()),
                        Err(poisoned) => {
                            eprintln!("Mutex poisoned for processor {}, attempting recovery", idx);
                            (idx, poisoned.into_inner().get_pitch())
                        }
                    }
                })
            })
            .collect::<Vec<_>>()
    };

    let mut results: Vec<(usize, f32)> = join_all(futures)
        .await
        .into_iter()
        .filter_map(|r: Result<(usize, f32), _>| r.ok())
        .collect();

    results.sort_by_key(|(idx, _)| *idx);
    let pitches: Vec<f32> = results.into_iter().map(|(_, pitch)| pitch).collect();

    Ok(pitches)
}
