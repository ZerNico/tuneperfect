use std::sync::{Arc, Mutex};

use crate::{
    audio::{processor::Processor, recorder::Recorder, MicrophoneOptions},
    error::AppError,
    state::{state, ProcessorMap},
};
use futures::future::join_all;

pub fn start_recording(
    options: Vec<MicrophoneOptions>,
    playback_enabled: bool,
    playback_volume: f32,
) -> Result<(), AppError> {
    let state = state();
    let mut recorder = state
        .recorder
        .write()
        .map_err(|_| AppError::RecorderError("Failed to acquire recorder lock".to_string()))?;

    if recorder.is_some() {
        clear_processors()?;
        recorder.take();
    }

    *recorder = Some(Recorder::new(
        state.processors.clone(),
        options,
        playback_enabled,
        playback_volume,
    )?);
    Ok(())
}

pub fn stop_recording() -> Result<(), AppError> {
    let state = state();
    let mut recorder = state
        .recorder
        .write()
        .map_err(|_| AppError::RecorderError("Failed to acquire recorder lock".to_string()))?;

    if recorder.is_none() {
        return Err(AppError::RecorderError("recorder not started".to_string()));
    }

    clear_processors()?;
    recorder.take();
    Ok(())
}

/// Forgets the running recording's processors. The lock is released before the recorder is
/// dropped: dropping it joins the analysis worker, which reads the processors, so holding the
/// lock across the drop would deadlock.
fn clear_processors() -> Result<(), AppError> {
    state()
        .processors
        .write()
        .map_err(|_| AppError::ProcessorError("Failed to acquire processors lock".to_string()))?
        .clear();
    Ok(())
}

/// The processors by mic index, with `None` where a configured mic has none (its device
/// wasn't found), so the results stay indexed like the mics the game asked for.
fn processors_by_slot(
    processors: &ProcessorMap,
) -> Result<Vec<Option<Arc<Mutex<Processor>>>>, AppError> {
    let processors = processors
        .read()
        .map_err(|_| AppError::ProcessorError("Failed to acquire processors lock".to_string()))?;
    let slots = processors.keys().max().map_or(0, |max| max + 1);
    Ok((0..slots)
        .map(|index| processors.get(&index).cloned())
        .collect())
}

/// Runs `measure` on every processor in parallel; `missing` for a slot without one.
async fn per_slot<F>(measure: F, missing: f32) -> Result<Vec<f32>, AppError>
where
    F: Fn(&mut Processor) -> f32 + Copy + Send + 'static,
{
    let tasks = processors_by_slot(&state().processors)?
        .into_iter()
        .map(|slot| async move {
            let Some(processor) = slot else {
                return missing;
            };
            tokio::task::spawn_blocking(move || {
                let mut processor = processor
                    .lock()
                    .unwrap_or_else(|poisoned| poisoned.into_inner());
                measure(&mut processor)
            })
            .await
            .unwrap_or(missing)
        });
    Ok(join_all(tasks).await)
}

pub async fn get_pitches(window_ms: f32) -> Result<Vec<f32>, AppError> {
    per_slot(move |processor| processor.get_pitch(window_ms), -1.0).await
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;
    use std::sync::RwLock;

    fn processor() -> Arc<Mutex<Processor>> {
        let options = MicrophoneOptions {
            device_id: None,
            name: "Mic".into(),
            channel: 0,
            gain: 1.0,
            threshold: 1.0,
            delay: 0.0,
        };
        Arc::new(Mutex::new(Processor::new(options, 48_000).0))
    }

    #[test]
    fn a_missing_mic_leaves_a_gap_instead_of_hiding_the_rest() {
        let map: ProcessorMap = Arc::new(RwLock::new(HashMap::from([
            (1, processor()),
            (3, processor()),
        ])));
        let slots = processors_by_slot(&map).unwrap();
        assert_eq!(
            slots.iter().map(Option::is_some).collect::<Vec<_>>(),
            vec![false, true, false, true]
        );

        let empty: ProcessorMap = Arc::new(RwLock::new(HashMap::new()));
        assert!(processors_by_slot(&empty).unwrap().is_empty());
    }
}
