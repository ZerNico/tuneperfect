use std::sync::Arc;
use std::time::Duration;

use reqwest::{cookie::Jar, Client};

use crate::error::AppError;
use crate::ultrastar::parser::parse_ultrastar_txt;
use crate::usdb::models::{UsdbSearchEntry, UsdbSong, UsdbSongPreview};
use crate::usdb::parser;

const BASE_URL: &str = "https://usdb.animux.de";
const SONGS_PER_PAGE: u32 = 100;
const MAX_SONG_ID: u32 = 100_000;

pub struct UsdbClient {
    client: Client,
    cookie_jar: Arc<Jar>,
    logged_in: bool,
}

impl Clone for UsdbClient {
    fn clone(&self) -> Self {
        Self {
            client: self.client.clone(), // reqwest::Client is Arc-wrapped, cheap clone
            cookie_jar: self.cookie_jar.clone(),
            logged_in: self.logged_in,
        }
    }
}

impl UsdbClient {
    pub fn new() -> Self {
        let cookie_jar = Arc::new(Jar::default());
        let client = Client::builder()
            .cookie_provider(cookie_jar.clone())
            .user_agent("TunePerfect/1.0")
            .timeout(Duration::from_secs(30))
            .build()
            .expect("Failed to create HTTP client");

        Self {
            client,
            cookie_jar,
            logged_in: false,
        }
    }

    pub async fn login(&mut self, username: &str, password: &str) -> Result<bool, AppError> {
        let url = format!("{}/", BASE_URL);
        let params = [("user", username), ("pass", password), ("login", "Login")];

        let response = self
            .client
            .post(&url)
            .form(&params)
            .send()
            .await
            .map_err(|e| AppError::UsdbError(format!("Login request failed: {}", e)))?;

        let body = response
            .text()
            .await
            .map_err(|e| AppError::UsdbError(format!("Failed to read login response: {}", e)))?;

        if body.contains("Login or Password invalid, please try again.") {
            self.logged_in = false;
            return Ok(false);
        }

        self.logged_in = true;
        Ok(true)
    }

    pub async fn is_logged_in(&self) -> Result<bool, AppError> {
        if !self.logged_in {
            return Ok(false);
        }

        let url = format!("{}/?link=profil", BASE_URL);
        let response = self
            .client
            .get(&url)
            .send()
            .await
            .map_err(|e| AppError::UsdbError(format!("Profile check failed: {}", e)))?;

        let body = response
            .text()
            .await
            .map_err(|e| AppError::UsdbError(format!("Failed to read profile response: {}", e)))?;

        Ok(!body.contains("You are not logged in"))
    }

    pub async fn logout(&mut self) -> Result<(), AppError> {
        let url = format!("{}/?link=logout", BASE_URL);
        let _ = self
            .client
            .post(&url)
            .send()
            .await
            .map_err(|e| AppError::UsdbError(format!("Logout request failed: {}", e)))?;

        self.logged_in = false;

        let cookie_jar = Arc::new(Jar::default());
        let client = Client::builder()
            .cookie_provider(cookie_jar.clone())
            .user_agent("TunePerfect/1.0")
            .timeout(Duration::from_secs(30))
            .build()
            .map_err(|e| AppError::UsdbError(format!("Failed to recreate client: {}", e)))?;

        self.client = client;
        self.cookie_jar = cookie_jar;

        Ok(())
    }

    /// Paginates through all USDB songs (100 per page, ordered by ID).
    pub async fn fetch_all_songs(&self) -> Result<Vec<UsdbSearchEntry>, AppError> {
        self.ensure_logged_in()?;

        let url = format!("{}/index.php?link=list", BASE_URL);
        let mut all_songs = Vec::new();

        for start in (0..MAX_SONG_ID).step_by(SONGS_PER_PAGE as usize) {
            let limit_str = SONGS_PER_PAGE.to_string();
            let start_str = start.to_string();

            let params = [
                ("order", "id"),
                ("ud", "asc"),
                ("limit", &limit_str),
                ("start", &start_str),
                ("details", "1"),
            ];

            let response = self
                .client
                .post(&url)
                .form(&params)
                .send()
                .await
                .map_err(|e| {
                    AppError::UsdbError(format!("Catalog fetch failed at offset {}: {}", start, e))
                })?;

            let body = response.text().await.map_err(|e| {
                AppError::UsdbError(format!("Failed to read catalog page at offset {}: {}", start, e))
            })?;

            self.check_login_error(&body)?;

            let batch = parser::parse_song_list(&body);
            let batch_len = batch.len();
            all_songs.extend(batch);

            log::info!(
                "Fetched USDB catalog page: offset={}, got={}, total={}",
                start,
                batch_len,
                all_songs.len()
            );

            if batch_len < SONGS_PER_PAGE as usize {
                break;
            }
        }

        Ok(all_songs)
    }

    /// Fetches songs changed since `last_mtime` (ordered by lastchange DESC, stops at watermark).
    pub async fn fetch_updated_songs(
        &self,
        last_mtime: i32,
        last_song_ids: &[u32],
    ) -> Result<Vec<UsdbSearchEntry>, AppError> {
        self.ensure_logged_in()?;

        let url = format!("{}/index.php?link=list", BASE_URL);
        let mut updated_songs = Vec::new();

        for start in (0..MAX_SONG_ID).step_by(SONGS_PER_PAGE as usize) {
            let limit_str = SONGS_PER_PAGE.to_string();
            let start_str = start.to_string();

            let params = [
                ("order", "lastchange"),
                ("ud", "desc"),
                ("limit", &limit_str),
                ("start", &start_str),
                ("details", "1"),
            ];

            let response = self
                .client
                .post(&url)
                .form(&params)
                .send()
                .await
                .map_err(|e| {
                    AppError::UsdbError(format!(
                        "Incremental fetch failed at offset {}: {}",
                        start, e
                    ))
                })?;

            let body = response.text().await.map_err(|e| {
                AppError::UsdbError(format!(
                    "Failed to read incremental page at offset {}: {}",
                    start, e
                ))
            })?;

            self.check_login_error(&body)?;

            let batch = parser::parse_song_list(&body);
            let batch_len = batch.len();

            let mut reached_watermark = false;
            for song in &batch {
                if song.usdb_mtime > last_mtime
                    || (song.usdb_mtime >= last_mtime
                        && !last_song_ids.contains(&song.song_id))
                {
                    updated_songs.push(song.clone());
                } else {
                    reached_watermark = true;
                }
            }

            log::info!(
                "Incremental fetch: offset={}, got={}, new={}",
                start,
                batch_len,
                updated_songs.len()
            );

            if reached_watermark || batch_len < SONGS_PER_PAGE as usize {
                break;
            }
        }

        Ok(updated_songs)
    }

    /// Fetches the song txt and extracts YouTube ID, BPM, etc. for the search UI preview.
    pub async fn get_song_preview(&self, song_id: u32) -> Result<UsdbSongPreview, AppError> {
        self.ensure_logged_in()?;

        let txt_content = self.get_song_txt(song_id).await?;

        let mut youtube_id: Option<String> = None;
        let mut video_url: Option<String> = None;
        let mut bpm: Option<f64> = None;
        let mut gap: Option<f64> = None;
        let mut artist = String::new();
        let mut title = String::new();
        let mut genre = String::new();
        let mut year: Option<u16> = None;
        let mut language = String::new();
        let mut creator = String::new();
        let mut edition = String::new();

        for line in txt_content.lines() {
            let line = line.trim();
            if !line.starts_with('#') {
                break;
            }
            if let Some((key, value)) = line[1..].split_once(':') {
                let key = key.trim().to_lowercase();
                let value = value.trim();
                match key.as_str() {
                    "video" => {
                        let (yt_id, yt_url) = extract_youtube_from_video_tag(value);
                        youtube_id = yt_id;
                        video_url = yt_url;
                    }
                    "bpm" => bpm = value.replace(",", ".").parse().ok(),
                    "gap" => gap = value.replace(",", ".").parse().ok(),
                    "artist" => artist = value.to_string(),
                    "title" => title = value.to_string(),
                    "genre" => genre = value.to_string(),
                    "year" => year = value.parse().ok(),
                    "language" => language = value.to_string(),
                    "author" | "creator" => creator = value.to_string(),
                    "edition" => edition = value.to_string(),
                    _ => {}
                }
            }
        }

        let cover_url = format!("{}/data/cover/{}.jpg", BASE_URL, song_id);

        let song = UsdbSearchEntry {
            song_id,
            artist,
            title,
            genre,
            year,
            language,
            creator,
            edition,
            golden_notes: false,
            rating: 0.0,
            views: 0,
            cover_url: Some(cover_url),
            sample_url: None,
            usdb_mtime: 0,
        };

        Ok(UsdbSongPreview {
            song,
            youtube_id,
            video_url,
            bpm,
            gap,
        })
    }

    /// Fetches and fully parses a USDB song (notes, voices, etc.) for gameplay.
    pub async fn get_song(&self, song_id: u32) -> Result<UsdbSong, AppError> {
        self.ensure_logged_in()?;

        let txt_content = self.get_song_txt(song_id).await?;

        let mut audio_youtube_id: Option<String> = None;
        let mut video_youtube_id: Option<String> = None;
        for line in txt_content.lines() {
            let line = line.trim();
            if !line.starts_with('#') {
                break;
            }
            if let Some((key, value)) = line[1..].split_once(':') {
                let key = key.trim().to_lowercase();
                if key == "video" {
                    let (a_id, v_id) = extract_audio_video_ids(value.trim());
                    audio_youtube_id = a_id;
                    video_youtube_id = v_id;
                    break;
                }
            }
        }

        let mut song = parse_ultrastar_txt(&txt_content).or_else(|e| {
            log::warn!("Standard parsing failed, trying relaxed parse: {}", e);
            parse_ultrastar_txt_relaxed(&txt_content)
        })?;

        song.audio = None;
        song.video = None;
        song.cover = None;
        song.background = None;
        song.instrumental = None;

        let cover_url = format!("{}/data/cover/{}.jpg", BASE_URL, song_id);

        Ok(UsdbSong {
            song_id,
            song,
            audio_youtube_id,
            video_youtube_id,
            cover_url: Some(cover_url),
        })
    }

    pub async fn get_song_txt(&self, song_id: u32) -> Result<String, AppError> {
        self.ensure_logged_in()?;

        let url = format!("{}/index.php?link=gettxt&id={}", BASE_URL, song_id);

        let response = self
            .client
            .post(&url)
            .header("Content-Type", "application/x-www-form-urlencoded")
            .body("wd=1")
            .send()
            .await
            .map_err(|e| AppError::UsdbError(format!("Get txt request failed: {}", e)))?;

        let body = response
            .text()
            .await
            .map_err(|e| AppError::UsdbError(format!("Failed to read txt response: {}", e)))?;

        self.check_login_error(&body)?;

        parser::parse_song_txt(&body)
            .ok_or_else(|| AppError::UsdbError("Could not find song txt in response".to_string()))
    }

    fn ensure_logged_in(&self) -> Result<(), AppError> {
        if !self.logged_in {
            return Err(AppError::UsdbError("Not logged in to USDB".to_string()));
        }
        Ok(())
    }

    fn check_login_error(&self, body: &str) -> Result<(), AppError> {
        if body.contains("You are not logged in") {
            return Err(AppError::UsdbError(
                "Session expired, please log in again".to_string(),
            ));
        }
        if body.contains("Datensatz nicht gefunden") {
            return Err(AppError::UsdbError("Song not found".to_string()));
        }
        Ok(())
    }
}

fn extract_youtube_from_video_tag(value: &str) -> (Option<String>, Option<String>) {
    let mut youtube_id: Option<String> = None;
    let mut video_url: Option<String> = None;

    let meta = parser::parse_video_meta_tag(value);

    // Prefer a= (audio) over v= (video) since notes/GAP are timed to the audio source
    if let Some(a_resource) = meta.get("a") {
        youtube_id = parser::video_resource_to_youtube_id(a_resource);
    }
    if youtube_id.is_none() {
        if let Some(v_resource) = meta.get("v") {
            youtube_id = parser::video_resource_to_youtube_id(v_resource);
        }
    }
    if youtube_id.is_none() && !value.contains('=') {
        youtube_id = parser::video_resource_to_youtube_id(value);
    }

    if let Some(ref yt_id) = youtube_id {
        video_url = Some(format!("https://www.youtube.com/watch?v={}", yt_id));
    }

    (youtube_id, video_url)
}

fn extract_audio_video_ids(value: &str) -> (Option<String>, Option<String>) {
    let meta = parser::parse_video_meta_tag(value);

    let audio_id = meta
        .get("a")
        .and_then(|r| parser::video_resource_to_youtube_id(r));
    let video_id = meta
        .get("v")
        .and_then(|r| parser::video_resource_to_youtube_id(r));

    // If the tag isn't key=value format, treat it as a single resource (used for both)
    if audio_id.is_none() && video_id.is_none() && !value.contains('=') {
        let id = parser::video_resource_to_youtube_id(value);
        return (id.clone(), id);
    }

    (audio_id, video_id)
}

/// Injects a dummy #AUDIO tag so the parser doesn't reject songs without audio/video.
fn parse_ultrastar_txt_relaxed(
    content: &str,
) -> Result<crate::ultrastar::song::Song, AppError> {
    let mut modified_content = String::new();
    let mut has_audio = false;
    let mut has_video = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if trimmed.to_lowercase().starts_with("#mp3:")
            || trimmed.to_lowercase().starts_with("#audio:")
        {
            has_audio = true;
        }
        if trimmed.to_lowercase().starts_with("#video:") {
            has_video = true;
        }
        modified_content.push_str(line);
        modified_content.push('\n');
    }

    if !has_audio && !has_video {
        modified_content = format!("#AUDIO:dummy.mp3\n{}", modified_content);
    }

    parse_ultrastar_txt(&modified_content)
}
