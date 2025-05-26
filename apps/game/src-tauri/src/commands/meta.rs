use crate::error::AppError;
use lofty::{file::TaggedFileExt, probe::Probe, tag::ItemKey};
use serde::Serialize;

#[derive(Debug, Serialize, specta::Type)]
pub struct ReplayGainInfo {
    track_gain: Option<f32>,
    track_peak: Option<f32>,
    album_gain: Option<f32>,
    album_peak: Option<f32>,
}

fn parse_replay_gain(value: Option<&str>) -> Option<f32> {
    value.and_then(|s| s.trim_end_matches(" dB").parse::<f32>().ok())
}

#[tauri::command]
#[specta::specta]
pub fn get_replay_gain(path: &str) -> Result<ReplayGainInfo, AppError> {
    let file = Probe::open(path)?.read()?;

    let tag = match file.primary_tag().or_else(|| file.first_tag()) {
        Some(tag) => tag,
        None => {
            return Ok(ReplayGainInfo {
                track_gain: None,
                track_peak: None,
                album_gain: None,
                album_peak: None,
            })
        }
    };

    Ok(ReplayGainInfo {
        track_gain: parse_replay_gain(tag.get_string(&ItemKey::ReplayGainTrackGain)),
        track_peak: parse_replay_gain(tag.get_string(&ItemKey::ReplayGainTrackPeak)),
        album_gain: parse_replay_gain(tag.get_string(&ItemKey::ReplayGainAlbumGain)),
        album_peak: parse_replay_gain(tag.get_string(&ItemKey::ReplayGainAlbumPeak)),
    })
}
