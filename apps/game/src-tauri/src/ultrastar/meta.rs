use lofty::{file::FileType, file::TaggedFileExt, probe::Probe, tag::ItemKey};
use serde::Serialize;

use crate::error::AppError;

#[derive(Debug, Serialize, specta::Type)]
pub struct ReplayGainInfo {
    pub track_gain: Option<f32>,
    pub track_peak: Option<f32>,
    pub album_gain: Option<f32>,
    pub album_peak: Option<f32>,
}

fn parse_replay_gain(value: Option<&str>) -> Option<f32> {
    value.and_then(|s| s.trim_end_matches(" dB").parse::<f32>().ok())
}

fn parse_opus_r128_gain(value: Option<&str>) -> Option<f32> {
    value.and_then(|s| {
        // Opus R128 gain values are stored as integers
        // Divide by 256 to get dB, then add 5 dB to compensate for -23 LUFS vs -18 LUFS
        s.parse::<i32>().ok().map(|gain_int| {
            let gain_db = gain_int as f32 / 256.0;
            gain_db + 5.0
        })
    })
}

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

    if file.file_type() == FileType::Opus {
        return Ok(ReplayGainInfo {
            track_gain: parse_opus_r128_gain(
                tag.get_string(&ItemKey::Unknown("R128_TRACK_GAIN".to_string())),
            ),
            track_peak: None,
            album_gain: parse_opus_r128_gain(
                tag.get_string(&ItemKey::Unknown("R128_ALBUM_GAIN".to_string())),
            ),
            album_peak: None,
        });
    }

    Ok(ReplayGainInfo {
        track_gain: parse_replay_gain(tag.get_string(&ItemKey::ReplayGainTrackGain)),
        track_peak: parse_replay_gain(tag.get_string(&ItemKey::ReplayGainTrackPeak)),
        album_gain: parse_replay_gain(tag.get_string(&ItemKey::ReplayGainAlbumGain)),
        album_peak: parse_replay_gain(tag.get_string(&ItemKey::ReplayGainAlbumPeak)),
    })
}
