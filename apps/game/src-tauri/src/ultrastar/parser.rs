use std::fs;
use unicode_normalization::UnicodeNormalization;

use crate::{
    error::AppError,
    ultrastar::{
        filesystem::FileEntry,
        meta::get_replay_gain,
        song::{LocalSong, Note, NoteType, Phrase, Song, Voice},
    },
};

fn tag_to_note_type(tag: &str) -> NoteType {
    match tag {
        ":" => NoteType::Normal,
        "*" => NoteType::Golden,
        "F" => NoteType::Freestyle,
        "R" => NoteType::Rap,
        "G" => NoteType::RapGolden,
        _ => NoteType::Freestyle,
    }
}

fn parse_us_int(value: &str, property: &str) -> Result<i32, AppError> {
    value.replace(",", ".").parse::<i32>().map_err(|_| {
        AppError::UltrastarError(format!(
            "Failed to parse integer for {}: {}",
            property, value
        ))
    })
}

fn parse_us_float(value: &str, property: &str) -> Result<f64, AppError> {
    value.replace(",", ".").parse::<f64>().map_err(|_| {
        AppError::UltrastarError(format!("Failed to parse float for {}: {}", property, value))
    })
}

fn parse_us_bool(value: &str) -> bool {
    matches!(value.to_lowercase().as_str(), "yes" | "true" | "1")
}

pub fn parse_ultrastar_txt(content: &str) -> Result<Song, AppError> {
    let content = content.strip_prefix('\u{FEFF}').unwrap_or(content);

    let mut song = Song {
        title: String::new(),
        artist: String::new(),
        bpm: 0.0,
        gap: 0.0,
        video_gap: 0.0,
        start: None,
        end: None,
        hash: String::new(),
        album: None,
        language: None,
        edition: None,
        genre: None,
        year: None,
        creator: None,
        relative: Some(false),
        audio: None,
        instrumental: None,
        cover: None,
        video: None,
        background: None,
        p1: None,
        p2: None,
        preview_start: None,
        voices: Vec::new(),
    };

    let mut notes: Vec<Note> = Vec::new();
    let mut phrases: Vec<Phrase> = Vec::new();
    let mut voices: Vec<Voice> = Vec::new();
    let mut md5_context = md5::Context::new();

    let lines: Vec<&str> = content.lines().collect();

    for (_index, line) in lines.iter().enumerate() {
        let line = line.trim_start();
        if line.is_empty() {
            continue;
        }

        if line.starts_with('#') {
            let line = line.trim();
            if let Some((property, value)) = line[1..].split_once(':') {
                let property = property.trim().to_lowercase();
                let value = value.trim();

                match property.as_str() {
                    "title" => song.title = value.to_string(),
                    "artist" => song.artist = value.to_string(),
                    "language" => song.language = Some(value.to_string()),
                    "edition" => song.edition = Some(value.to_string()),
                    "genre" => song.genre = Some(value.to_string()),
                    "year" => {
                        if value.is_empty() {
                            song.year = None;
                        } else {
                            song.year = Some(parse_us_int(value, &property)?);
                        }
                    }
                    "bpm" => song.bpm = parse_us_float(value, &property)?,
                    "gap" => song.gap = parse_us_float(value, &property)?,
                    "start" => song.start = Some(parse_us_float(value, &property)?),
                    "end" => song.end = Some(parse_us_int(value, &property)?),
                    "mp3" | "audio" => song.audio = Some(value.to_string()),
                    "instrumental" => song.instrumental = Some(value.to_string()),
                    "cover" => song.cover = Some(value.to_string()),
                    "video" => song.video = Some(value.to_string()),
                    "background" => song.background = Some(value.to_string()),
                    "relative" => song.relative = Some(parse_us_bool(value)),
                    "videogap" => song.video_gap = parse_us_float(value, &property)?,
                    "author" | "creator" => song.creator = Some(value.to_string()),
                    "duetsingerp1" | "p1" => song.p1 = Some(value.to_string()),
                    "duetsingerp2" | "p2" => song.p2 = Some(value.to_string()),
                    "preview" | "previewstart" => {
                        song.preview_start = Some(parse_us_float(value, &property)?)
                    }
                    _ => {}
                }
            }
        } else if [":", "*", "F", "R", "G"]
            .contains(&line.chars().next().unwrap_or(' ').to_string().as_str())
        {
            // Parse note
            let parts: Vec<&str> = line.splitn(5, ' ').collect();
            if parts.len() >= 5 {
                let tag = parts[0];
                let start_beat = parse_us_int(parts[1], "start_beat")?;
                let length = parse_us_int(parts[2], "length")?;
                let txt_pitch = parse_us_int(parts[3], "txt_pitch")?;
                let text = parts[4..].join(" ");

                let note = Note {
                    note_type: tag_to_note_type(tag),
                    start_beat,
                    length,
                    txt_pitch,
                    midi_note: txt_pitch + 60,
                    text,
                };

                notes.push(note);
                md5_context.consume(format!("{} {} {} {}", tag, parts[1], parts[2], parts[3]));
            }
        } else if line.starts_with('-') {
            // Line break
            if let Some(disappear_beat_str) = line[1..].trim().split_whitespace().next() {
                let disappear_beat = parse_us_int(disappear_beat_str, "disappear_beat")?;
                let phrase = Phrase {
                    disappear_beat,
                    notes: std::mem::take(&mut notes),
                };
                phrases.push(phrase);
                md5_context.consume(line);
            }
        } else if line.starts_with('P') {
            // Player change
            if !phrases.is_empty() || !notes.is_empty() {
                if !notes.is_empty() {
                    let last_note = notes.last().unwrap();
                    let phrase = Phrase {
                        disappear_beat: last_note.start_beat + last_note.length + 1,
                        notes: std::mem::take(&mut notes),
                    };
                    phrases.push(phrase);
                }
                let voice = Voice {
                    phrases: std::mem::take(&mut phrases),
                };
                voices.push(voice);
            }
            md5_context.consume(b"P");
        } else if line.starts_with('E') {
            // End
            if !notes.is_empty() {
                let last_note = notes.last().unwrap();
                let phrase = Phrase {
                    disappear_beat: last_note.start_beat + last_note.length + 1,
                    notes: std::mem::take(&mut notes),
                };
                phrases.push(phrase);
            }
            if !phrases.is_empty() {
                let voice = Voice {
                    phrases: std::mem::take(&mut phrases),
                };
                voices.push(voice);
            }
            md5_context.consume(song.title.as_bytes());
            md5_context.consume(song.artist.as_bytes());

            song.hash = format!("{:x}", md5_context.compute());
            song.voices = voices;
            break;
        }
    }

    if song.title.is_empty() {
        return Err(AppError::UltrastarError("Missing song title".to_string()));
    }
    if song.artist.is_empty() {
        return Err(AppError::UltrastarError("Missing song artist".to_string()));
    }
    if song.bpm == 0.0 {
        return Err(AppError::UltrastarError("Missing song BPM".to_string()));
    }
    if song.hash.is_empty() {
        return Err(AppError::UltrastarError("Missing song hash".to_string()));
    }
    if song.audio.is_none() && song.video.is_none() {
        return Err(AppError::UltrastarError(
            "Song must have either audio or video file".to_string(),
        ));
    }

    Ok(song)
}

pub fn parse_local_txt_file(
    txt: &str,
    files: &Vec<FileEntry>,
    media_base_url: &str,
) -> Result<LocalSong, AppError> {
    let content = fs::read_to_string(txt)?;
    let song = parse_ultrastar_txt(&content)?;

    let find_file = |filename: &Option<String>| -> Option<&FileEntry> {
        if let Some(filename) = filename {
            let normalized_target = filename.nfc().collect::<String>().to_lowercase();
            files.iter().find(|f| {
                let normalized_file = f.filename.nfc().collect::<String>().to_lowercase();
                normalized_file == normalized_target
            })
        } else {
            None
        }
    };

    let create_url_from_file =
        |file_entry: Option<&FileEntry>| -> Result<Option<String>, AppError> {
            if let Some(file_entry) = file_entry {
                let path = dunce::canonicalize(&file_entry.path)?;
                let path_string = path.to_string_lossy();
                let encoded = urlencoding::encode(&path_string);
                Ok(Some(format!("{}/{}", media_base_url, encoded)))
            } else {
                Ok(None)
            }
        };

    let audio_file = find_file(&song.audio);
    let instrumental_file = find_file(&song.instrumental);
    let video_file = find_file(&song.video);
    let cover_file = find_file(&song.cover);
    let background_file = find_file(&song.background);

    if song.audio.is_some() && audio_file.is_none() {
        return Err(AppError::UltrastarError(format!(
            "Audio file '{}' was specified but not found",
            song.audio.as_ref().unwrap()
        )));
    }

    if song.instrumental.is_some() && instrumental_file.is_none() {
        log::warn!(
            "Instrumental file '{}' was specified but not found",
            song.instrumental.as_ref().unwrap()
        );
    }
    if song.video.is_some() && video_file.is_none() {
        log::warn!(
            "Video file '{}' was specified but not found",
            song.video.as_ref().unwrap()
        );
    }
    if song.cover.is_some() && cover_file.is_none() {
        log::warn!(
            "Cover file '{}' was specified but not found",
            song.cover.as_ref().unwrap()
        );
    }
    if song.background.is_some() && background_file.is_none() {
        log::warn!(
            "Background file '{}' was specified but not found",
            song.background.as_ref().unwrap()
        );
    }

    let audio_url = create_url_from_file(audio_file)?;
    let instrumental_url = create_url_from_file(instrumental_file)?;
    let video_url = create_url_from_file(video_file)?;
    let cover_url = create_url_from_file(cover_file)?;
    let background_url = create_url_from_file(background_file)?;

    if audio_url.is_none() && video_url.is_none() {
        return Err(AppError::UltrastarError(
            "Song must have either audio or video file available".to_string(),
        ));
    }

    let replay_gain = audio_file.and_then(|file| get_replay_gain(&file.path).ok());

    Ok(LocalSong {
        song,
        audio_url,
        instrumental_url,
        video_url,
        cover_url,
        background_url,
        replay_gain_track_gain: replay_gain.as_ref().and_then(|rg| rg.track_gain),
        replay_gain_track_peak: replay_gain.as_ref().and_then(|rg| rg.track_peak),
    })
}
