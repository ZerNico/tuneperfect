use std::sync::LazyLock;

use regex::Regex;
use scraper::{Html, Selector};

use crate::usdb::models::UsdbSearchEntry;

static YT_ID_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^[A-Za-z0-9_-]{11}$").unwrap());
static VIMEO_ID_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"^\d{2,10}$").unwrap());
/// From <https://regexr.com/531i0>.
static YT_URL_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r"(?ix)
        (?:https?://)?(?:www\.)?(?:m\.)?
        (?:youtube\.com/|youtube-nocookie\.com/|youtu\.be/)
        \S*(?:/|%3D|v=|vi=)
        ([0-9A-Za-z_-]{11})
        (?:[%#?&]|$)
    ",
    )
    .unwrap()
});
static YT_SHORT_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r"(?i)youtu\.be/([0-9A-Za-z_-]{11})").unwrap());

pub fn parse_song_list(html: &str) -> Vec<UsdbSearchEntry> {
    let document = Html::parse_document(html);

    let row_selector = Selector::parse("tr[data-songid]").unwrap();
    let td_selector = Selector::parse("td").unwrap();
    let img_selector = Selector::parse("img").unwrap();
    let source_selector = Selector::parse("source").unwrap();
    let a_selector = Selector::parse("a").unwrap();

    let mut songs = Vec::new();

    for row in document.select(&row_selector) {
        let song_id: u32 = match row.value().attr("data-songid") {
            Some(id) => match id.parse() {
                Ok(id) => id,
                Err(_) => continue,
            },
            None => continue,
        };

        let usdb_mtime: i32 = row
            .value()
            .attr("data-lastchange")
            .and_then(|v| v.parse().ok())
            .unwrap_or(0);

        let tds: Vec<_> = row.select(&td_selector).collect();

        // Column order: 0=sample, 1=cover, 2=artist, 3=title, 4=genre,
        // 5=year, 6=edition, 7=golden_notes, 8=language, 9=creator, 10=rating, 11=views
        if tds.len() < 12 {
            continue;
        }

        let sample_url = tds[0]
            .select(&source_selector)
            .next()
            .and_then(|s| s.value().attr("src"))
            .map(|s| s.to_string());

        let cover_url = tds[1]
            .select(&img_selector)
            .next()
            .and_then(|img| img.value().attr("src"))
            .map(|src| {
                if src.starts_with("http") {
                    src.to_string()
                } else {
                    format!("https://usdb.animux.de/{}", src)
                }
            });

        let artist = get_td_text(&tds[2]);
        let title = tds[3]
            .select(&a_selector)
            .next()
            .map(|a| a.text().collect::<String>().trim().to_string())
            .unwrap_or_else(|| get_td_text(&tds[3]));
        let genre = get_td_text(&tds[4]);
        let year_str = get_td_text(&tds[5]);
        let year: Option<u16> = year_str.parse().ok();
        let edition = get_td_text(&tds[6]);
        let golden_notes_text = get_td_text(&tds[7]).to_lowercase();
        let golden_notes =
            golden_notes_text == "yes" || golden_notes_text == "ja" || golden_notes_text == "oui";
        let language = get_td_text(&tds[8]);
        let creator = get_td_text(&tds[9]);

        let rating_html = tds[10].inner_html();
        let full_stars = rating_html.matches("/star.png").count() as f32;
        let half_stars = rating_html.matches("/half_star.png").count() as f32 * 0.5;
        let rating = full_stars + half_stars;

        let views_str = get_td_text(&tds[11]);
        let views: u32 = views_str.replace(",", "").replace(".", "").parse().unwrap_or(0);

        songs.push(UsdbSearchEntry {
            song_id,
            artist,
            title,
            genre,
            year,
            language,
            creator,
            edition,
            golden_notes,
            rating,
            views,
            cover_url,
            sample_url,
            usdb_mtime,
        });
    }

    songs
}

pub fn parse_song_txt(html: &str) -> Option<String> {
    let document = Html::parse_document(html);
    let textarea_selector = Selector::parse("textarea").unwrap();

    document
        .select(&textarea_selector)
        .next()
        .map(|textarea| textarea.text().collect::<String>())
}

/// Parses the `#VIDEO` meta tag (comma-separated `key=value` pairs).
pub fn parse_video_meta_tag(video_tag: &str) -> std::collections::HashMap<String, String> {
    let mut tags = std::collections::HashMap::new();

    if !video_tag.contains('=') {
        return tags;
    }

    for pair in video_tag.split(',') {
        let pair = pair.trim();
        if let Some((key, value)) = pair.split_once('=') {
            let key = key.trim().to_lowercase();
            let value = decode_meta_tag_value(value.trim());
            tags.insert(key, value);
        }
    }

    tags
}

/// Tries to extract a YouTube video ID from a resource string
/// (could be a bare 11-char ID, a full URL, or a URL without protocol).
pub fn video_resource_to_youtube_id(resource: &str) -> Option<String> {
    let resource = resource.trim();

    if resource.is_empty() {
        return None;
    }

    if resource.contains("://") || resource.contains("youtube") || resource.contains("youtu.be") {
        return extract_youtube_id(resource);
    }

    if resource.contains('/') {
        return extract_youtube_id(&format!("https://{}", resource));
    }

    if YT_ID_PATTERN.is_match(resource) {
        return Some(resource.to_string());
    }

    // Vimeo IDs — can't embed these easily
    if VIMEO_ID_PATTERN.is_match(resource) {
        return None;
    }

    None
}

fn extract_youtube_id(url: &str) -> Option<String> {
    if let Some(caps) = YT_URL_PATTERN.captures(url) {
        return caps.get(1).map(|m| m.as_str().to_string());
    }

    if let Some(caps) = YT_SHORT_PATTERN.captures(url) {
        return caps.get(1).map(|m| m.as_str().to_string());
    }

    None
}

fn decode_meta_tag_value(value: &str) -> String {
    value
        .replace("%3D", "=")
        .replace("%26", "&")
        .replace("%3F", "?")
        .replace("%23", "#")
        .replace("%2F", "/")
        .replace("%3A", ":")
}

fn get_td_text(element: &scraper::ElementRef) -> String {
    element.text().collect::<String>().trim().to_string()
}
