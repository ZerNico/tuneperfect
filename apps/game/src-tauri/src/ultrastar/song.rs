use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub enum NoteType {
    Normal,
    Golden,
    Freestyle,
    Rap,
    RapGolden,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Note {
    #[serde(rename = "type")]
    pub note_type: NoteType,
    #[serde(rename = "startBeat")]
    pub start_beat: i32,
    pub length: i32,
    pub text: String,
    #[serde(rename = "txtPitch")]
    pub txt_pitch: i32,
    #[serde(rename = "midiNote")]
    pub midi_note: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Phrase {
    #[serde(rename = "disappearBeat")]
    pub disappear_beat: i32,
    pub notes: Vec<Note>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Voice {
    pub phrases: Vec<Phrase>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Song {
    pub title: String,
    pub artist: String,
    pub bpm: f64,
    pub gap: f64,
    #[serde(rename = "videoGap")]
    pub video_gap: f64,
    pub start: Option<f64>,
    pub end: Option<i32>,
    pub hash: String,
    pub album: Option<String>,
    pub language: Option<String>,
    pub edition: Option<String>,
    pub genre: Option<String>,
    pub year: Option<i32>,
    pub creator: Option<String>,
    pub relative: Option<bool>,
    pub audio: Option<String>,
    pub instrumental: Option<String>,
    pub cover: Option<String>,
    pub video: Option<String>,
    pub background: Option<String>,
    pub p1: Option<String>,
    pub p2: Option<String>,
    #[serde(rename = "previewStart")]
    pub preview_start: Option<f64>,
    pub voices: Vec<Voice>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct LocalSong {
    #[serde(flatten)]
    pub song: Song,
    #[serde(rename = "audioUrl")]
    pub audio_url: Option<String>,
    #[serde(rename = "instrumentalUrl")]
    pub instrumental_url: Option<String>,
    #[serde(rename = "videoUrl")]
    pub video_url: Option<String>,
    #[serde(rename = "coverUrl")]
    pub cover_url: Option<String>,
    #[serde(rename = "backgroundUrl")]
    pub background_url: Option<String>,
    #[serde(rename = "replayGainTrackGain")]
    pub replay_gain_track_gain: Option<f32>,
    #[serde(rename = "replayGainTrackPeak")]
    pub replay_gain_track_peak: Option<f32>,
}
