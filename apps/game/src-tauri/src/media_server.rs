use std::collections::HashMap;
use std::io::{Read, Seek, SeekFrom, Write};
use std::net::{TcpListener, TcpStream};
use std::path::PathBuf;
use std::sync::{Arc, Mutex};
use std::thread;

use http_range::HttpRange;
use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::{
    plugin::{Builder as PluginBuilder, TauriPlugin},
    Runtime, State, Manager,
};
use tauri_plugin_fs::FsExt;
use tauri_utils::mime_type::MimeType;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct MediaServerConfig {
    pub port: u16,
    pub host: String,
}

#[derive(Debug)]
pub struct MediaServerState {
    config: MediaServerConfig,
}

impl MediaServerState {
    pub fn new(config: MediaServerConfig) -> Self {
        Self { config }
    }

    pub fn get_base_url(&self) -> String {
        format!("http://{}:{}", self.config.host, self.config.port)
    }
}

#[tauri::command]
#[specta::specta]
pub async fn get_media_server_base_url(
    state: State<'_, Arc<Mutex<Option<MediaServerState>>>>,
) -> Result<Option<String>, String> {
    let state = state.lock().map_err(|e| e.to_string())?;
    Ok(state.as_ref().map(|s| s.get_base_url()))
}

fn find_available_port(start_port: u16) -> Option<u16> {
    for port in start_port..start_port + 100 {
        if TcpListener::bind(("127.0.0.1", port)).is_ok() {
            return Some(port);
        }
    }
    None
}

fn handle_request(
    request: &str,
    scope: &tauri::scope::fs::Scope,
) -> Result<Vec<u8>, Box<dyn std::error::Error + Send + Sync>> {
    let lines: Vec<&str> = request.lines().collect();
    if lines.is_empty() {
        return Err("Empty request".into());
    }

    let request_line = lines[0];
    let parts: Vec<&str> = request_line.split_whitespace().collect();
    if parts.len() < 2 {
        return Err("Invalid request line".into());
    }

    let method = parts[0];
    let path = parts[1];

    // Parse headers
    let mut headers = HashMap::new();
    for line in &lines[1..] {
        if line.is_empty() {
            break;
        }
        if let Some(colon_pos) = line.find(':') {
            let key = line[..colon_pos].trim().to_lowercase();
            let value = line[colon_pos + 1..].trim();
            headers.insert(key, value.to_string());
        }
    }

    // Skip leading `/`
    let file_path = if path.starts_with('/') {
        &path[1..]
    } else {
        path
    };

    let file_path = percent_encoding::percent_decode(file_path.as_bytes())
        .decode_utf8_lossy()
        .to_string();

    // Check if path is allowed by scope
    if !scope.is_allowed(&file_path) {
        return Ok(create_error_response(403, "Forbidden"));
    }

    let path_buf = PathBuf::from(&file_path);
    if !path_buf.exists() {
        return Ok(create_error_response(404, "Not Found"));
    }

    let mut file = std::fs::File::open(&path_buf)?;

    // Get file length
    let len = file.metadata()?.len();

    // Get file mime type
    let mime_type = {
        let magic_buf_size = 8192.min(len as usize);
        let mut magic_buf = vec![0u8; magic_buf_size];
        if magic_buf_size > 0 {
            file.read_exact(&mut magic_buf)?;
            file.seek(SeekFrom::Start(0))?;
        }
        MimeType::parse(&magic_buf, &file_path)
    };

    // Handle range requests
    if let Some(range_header) = headers.get("range") {
        handle_range_request(&mut file, len, &mime_type, range_header, method == "HEAD")
    } else if method == "HEAD" {
        Ok(create_head_response(len, &mime_type))
    } else {
        let mut content = Vec::new();
        file.read_to_end(&mut content)?;
        Ok(create_full_response(content, &mime_type))
    }
}

fn handle_range_request(
    file: &mut std::fs::File,
    len: u64,
    mime_type: &str,
    range_header: &str,
    is_head: bool,
) -> Result<Vec<u8>, Box<dyn std::error::Error + Send + Sync>> {
    let ranges = HttpRange::parse(range_header, len)
        .map_err(|e| format!("Range parse error: {:?}", e))?;

    if ranges.len() == 1 {
        let range = &ranges[0];
        let start = range.start;
        let end = (range.start + range.length - 1).min(len - 1);
        let content_length = end - start + 1;

        let mut response = format!(
            "HTTP/1.1 206 Partial Content\r\n\
             Content-Type: {}\r\n\
             Content-Range: bytes {}-{}/{}\r\n\
             Content-Length: {}\r\n\
             Accept-Ranges: bytes\r\n\
             Access-Control-Allow-Origin: *\r\n\
             Access-Control-Expose-Headers: content-range\r\n\
             \r\n",
            mime_type, start, end, len, content_length
        ).into_bytes();

        if !is_head {
            file.seek(SeekFrom::Start(start))?;
            let mut content = vec![0u8; content_length as usize];
            file.read_exact(&mut content)?;
            response.extend_from_slice(&content);
        }

        Ok(response)
    } else {
        // Multi-part ranges not implemented
        Ok(create_error_response(416, "Range Not Satisfiable"))
    }
}

fn create_full_response(content: Vec<u8>, mime_type: &str) -> Vec<u8> {
    let mut response = format!(
        "HTTP/1.1 200 OK\r\n\
         Content-Type: {}\r\n\
         Content-Length: {}\r\n\
         Accept-Ranges: bytes\r\n\
         Access-Control-Allow-Origin: *\r\n\
         \r\n",
        mime_type,
        content.len()
    ).into_bytes();
    response.extend_from_slice(&content);
    response
}

fn create_head_response(len: u64, mime_type: &str) -> Vec<u8> {
    format!(
        "HTTP/1.1 200 OK\r\n\
         Content-Type: {}\r\n\
         Content-Length: {}\r\n\
         Accept-Ranges: bytes\r\n\
         Access-Control-Allow-Origin: *\r\n\
         \r\n",
        mime_type, len
    ).into_bytes()
}

fn create_error_response(status: u16, message: &str) -> Vec<u8> {
    let body = format!("{} {}", status, message);
    format!(
        "HTTP/1.1 {} {}\r\n\
         Content-Type: text/plain\r\n\
         Content-Length: {}\r\n\
         Access-Control-Allow-Origin: *\r\n\
         \r\n{}",
        status,
        message,
        body.len(),
        body
    ).into_bytes()
}

fn handle_client(
    mut stream: TcpStream,
    scope: tauri::scope::fs::Scope,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let mut buffer = [0; 4096];
    let bytes_read = stream.read(&mut buffer)?;
    let request = String::from_utf8_lossy(&buffer[..bytes_read]);

    match handle_request(&request, &scope) {
        Ok(response) => {
            stream.write_all(&response)?;
        }
        Err(e) => {
            eprintln!("Error handling request: {}", e);
            let error_response = create_error_response(500, "Internal Server Error");
            let _ = stream.write_all(&error_response);
        }
    }

    Ok(())
}

pub fn create_media_server_plugin<R: Runtime>() -> TauriPlugin<R> {
    PluginBuilder::new("media-server")
        .setup(|app, _api| {
            let should_enable = cfg!(target_os = "linux");

            if !should_enable {
                app.manage(Arc::new(Mutex::new(None::<MediaServerState>)));
                return Ok(());
            }

            let port = find_available_port(8080).ok_or("No available port found")?;
            let host = "127.0.0.1".to_string();

            let config = MediaServerConfig {
                port,
                host: host.clone(),
            };

            let server_state = MediaServerState::new(config.clone());
            app.manage(Arc::new(Mutex::new(Some(server_state))));

            // Get the app handle for accessing the scope later
            let app_handle = app.app_handle().clone();

            // Start the server in a background thread
            thread::spawn(move || {
                let listener = match TcpListener::bind(format!("{}:{}", host, port)) {
                    Ok(listener) => listener,
                    Err(e) => {
                        eprintln!("Failed to bind media server: {}", e);
                        return;
                    }
                };

                println!("Media server listening on {}:{}", host, port);

                for stream in listener.incoming() {
                    match stream {
                        Ok(stream) => {
                            let app_handle_clone = app_handle.clone();
                            thread::spawn(move || {
                                // Get the actual fs scope from the app
                                let scope = app_handle_clone.fs_scope();
                                if let Err(e) = handle_client(stream, scope) {
                                    eprintln!("Error handling client: {}", e);
                                }
                            });
                        }
                        Err(e) => {
                            eprintln!("Error accepting connection: {}", e);
                        }
                    }
                }
            });

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_media_server_base_url
        ])
        .build()
}
