use serde::{Deserialize, Serialize};
use specta::Type;

use crate::ultrastar::song::Song;

/// Lightweight entry from USDB search results (no note data).
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UsdbSearchEntry {
    #[serde(rename = "songId")]
    pub song_id: u32,
    pub artist: String,
    pub title: String,
    pub genre: String,
    pub year: Option<u16>,
    pub language: String,
    pub creator: String,
    pub edition: String,
    #[serde(rename = "goldenNotes")]
    pub golden_notes: bool,
    pub rating: f32,
    pub views: u32,
    #[serde(rename = "coverUrl")]
    pub cover_url: Option<String>,
    #[serde(rename = "sampleUrl")]
    pub sample_url: Option<String>,
    /// Unix timestamp from USDB's `data-lastchange` attribute.
    #[serde(rename = "usdbMtime")]
    pub usdb_mtime: i32,
}

/// Preview info for the search UI (YouTube ID, BPM, etc. — no note data).
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UsdbSongPreview {
    pub song: UsdbSearchEntry,
    #[serde(rename = "youtubeId")]
    pub youtube_id: Option<String>,
    #[serde(rename = "videoUrl")]
    pub video_url: Option<String>,
    pub bpm: Option<f64>,
    pub gap: Option<f64>,
}

/// Full USDB song with parsed note data, ready for gameplay.
#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct UsdbSong {
    #[serde(rename = "songId")]
    pub song_id: u32,
    #[serde(flatten)]
    pub song: Song,
    /// YouTube ID for audio playback (from `a=` tag). Notes/GAP are timed to this.
    #[serde(rename = "audioYoutubeId")]
    pub audio_youtube_id: Option<String>,
    /// YouTube ID for video (from `v=` tag). Shown as visual, muted if separate audio exists.
    #[serde(rename = "videoYoutubeId")]
    pub video_youtube_id: Option<String>,
    #[serde(rename = "coverUrl")]
    pub cover_url: Option<String>,
}
