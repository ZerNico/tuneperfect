use std::convert::Infallible;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr, TcpListener as StdTcpListener};
use std::path::PathBuf;
use std::sync::Arc;

use http_body_util::combinators::UnsyncBoxBody;
use http_body_util::{BodyExt, Empty, Full};
use hyper::body::{Bytes, Incoming};
use hyper::server::conn::http1;
use hyper::service::service_fn;
use hyper::{Request, Response, StatusCode};
use hyper_util::rt::TokioIo;
use serde::{Deserialize, Serialize};
use tokio::net::TcpListener;
use tower::ServiceExt;
use tower_http::services::ServeFile;

/// Scope-checked song files live under this prefix, static assets under `/embed/`.
/// Namespacing both keeps either from shadowing the other: song paths are urlencoded
/// absolute paths, so without a prefix one could collide with an asset route.
const MEDIA_PREFIX: &str = "/media/";

/// `(path, content_type, body)`. Served verbatim, no scope check — these are compiled in,
/// not read from disk.
const STATIC_ASSETS: &[(&str, &str, &str)] = &[(
    "/embed/youtube",
    "text/html; charset=utf-8",
    include_str!("local_server/assets/youtube_player.html"),
)];

/// Unsync because that is what `ServeFile` produces; hyper only needs `Send`.
type ResponseBody = UnsyncBoxBody<Bytes, std::io::Error>;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalServerConfig {
    pub port: u16,
    pub host: String,
}

#[derive(Debug)]
pub struct LocalServerState {
    config: LocalServerConfig,
}

impl LocalServerState {
    pub fn new(config: LocalServerConfig) -> Self {
        Self { config }
    }

    /// Origin only, without a route prefix. Callers append their own namespace.
    pub fn get_base_url(&self) -> String {
        format!("http://{}:{}", self.config.host, self.config.port)
    }

    /// Base URL for song files, including the `/media` prefix the router expects.
    pub fn get_media_base_url(&self) -> String {
        format!(
            "{}{}",
            self.get_base_url(),
            MEDIA_PREFIX.trim_end_matches('/')
        )
    }
}

/// Listeners covering every loopback address `localhost` can resolve to, plus the port
/// they share.
///
/// Searching and binding are one step on purpose. Probing a port with a throwaway bind and
/// re-binding it afterwards leaves a gap for another process to take it, and would let the
/// server come up on IPv4 only while still advertising `localhost` — the connection-refused
/// failure this dual bind exists to prevent. Here the returned listeners *are* the ones
/// that were tested, so the invariant holds by construction.
///
/// IPv6 is skipped only when the host cannot do IPv6 loopback at all.
fn bind_loopback_listeners(start_port: u16) -> Option<(u16, Vec<StdTcpListener>)> {
    let ipv6_available = StdTcpListener::bind((Ipv6Addr::LOCALHOST, 0)).is_ok();

    let required: &[IpAddr] = if ipv6_available {
        &[
            IpAddr::V4(Ipv4Addr::LOCALHOST),
            IpAddr::V6(Ipv6Addr::LOCALHOST),
        ]
    } else {
        &[IpAddr::V4(Ipv4Addr::LOCALHOST)]
    };

    (start_port..start_port + 100).find_map(|port| {
        let listeners: Vec<StdTcpListener> = required
            .iter()
            .map_while(|addr| StdTcpListener::bind((*addr, port)).ok())
            .collect();

        // Partial success means the port is contended on one family; drop what we bound
        // and try the next one rather than serving on a subset.
        if listeners.len() == required.len() {
            Some((port, listeners))
        } else {
            None
        }
    })
}

/// What a path resolves to, decided before any I/O so it can be asserted in tests.
#[derive(Debug, PartialEq, Eq)]
enum Route<'a> {
    /// A compiled-in asset: `(content_type, body)`. `'static`, not borrowed from the
    /// request, so a response can outlive the path it was routed from.
    StaticAsset(&'static str, &'static str),
    /// A song file, holding the still-encoded path that follows `MEDIA_PREFIX`.
    MediaFile(&'a str),
    NotFound,
}

fn route(path: &str) -> Route<'_> {
    if let Some((_, content_type, body)) = STATIC_ASSETS.iter().find(|(route, _, _)| *route == path)
    {
        return Route::StaticAsset(content_type, body);
    }

    if let Some(encoded_path) = path.strip_prefix(MEDIA_PREFIX) {
        return Route::MediaFile(encoded_path);
    }

    Route::NotFound
}

fn full_body(content: impl Into<Bytes>) -> ResponseBody {
    Full::new(content.into())
        .map_err(|never| match never {})
        .boxed_unsync()
}

fn status_response(status: StatusCode) -> Response<ResponseBody> {
    Response::builder()
        .status(status)
        .header("Content-Type", "text/plain")
        .body(full_body(status.canonical_reason().unwrap_or("Error")))
        .expect("status response is well formed")
}

fn static_response(
    content_type: &str,
    body: &'static str,
    frame_ancestors: &str,
) -> Response<ResponseBody> {
    Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", content_type)
        .header("Cache-Control", "no-store")
        .header(
            "Content-Security-Policy",
            format!("frame-ancestors {}", frame_ancestors),
        )
        .body(full_body(body))
        .expect("static response is well formed")
}

/// Decides whether a decoded path may be served. Implemented by the app's path allowlist;
/// tests substitute their own so serving can be exercised without real folders.
pub trait PathPolicy: Send + Sync + 'static {
    fn is_allowed(&self, path: &str) -> bool;
}

/// Serves a song file after checking it against the fs scope.
///
/// `ServeFile` handles ranges, conditional requests, HEAD and streaming, so seeking within
/// a large media file stays a partial read instead of a full download.
async fn serve_scoped_file(
    encoded_path: &str,
    request: Request<Incoming>,
    policy: &dyn PathPolicy,
) -> Response<ResponseBody> {
    let file_path = percent_encoding::percent_decode(encoded_path.as_bytes())
        .decode_utf8_lossy()
        .to_string();

    if !policy.is_allowed(&file_path) {
        return status_response(StatusCode::FORBIDDEN);
    }

    let path_buf = PathBuf::from(&file_path);

    // `ServeFile` needs the request path to resolve, but the real path came from our own
    // prefix-stripped URL, so hand it a bare request carrying only method and headers.
    let (parts, _body) = request.into_parts();
    let mut file_request = Request::builder().method(parts.method.clone()).uri("/");
    if let Some(headers) = file_request.headers_mut() {
        *headers = parts.headers.clone();
    }
    let file_request = match file_request.body(Empty::<Bytes>::new()) {
        Ok(request) => request,
        Err(_) => return status_response(StatusCode::INTERNAL_SERVER_ERROR),
    };

    match ServeFile::new(&path_buf).oneshot(file_request).await {
        Ok(response) => {
            let (mut parts, body) = response.into_parts();
            // The webview fetches media from a different origin than the app document.
            parts.headers.insert(
                "Access-Control-Allow-Origin",
                "*".parse().expect("static header value"),
            );
            parts.headers.insert(
                "Access-Control-Expose-Headers",
                "content-range".parse().expect("static header value"),
            );
            Response::from_parts(parts, body.boxed_unsync())
        }
        Err(error) => {
            log::warn!("Local server failed to serve {}: {}", file_path, error);
            status_response(StatusCode::INTERNAL_SERVER_ERROR)
        }
    }
}

async fn handle_request(
    request: Request<Incoming>,
    policy: Arc<dyn PathPolicy>,
    frame_ancestors: Arc<String>,
) -> Result<Response<ResponseBody>, Infallible> {
    // Matching on the path alone keeps the query string out of routing decisions.
    let path = request.uri().path().to_string();

    let response = match route(&path) {
        Route::StaticAsset(content_type, body) => {
            static_response(content_type, body, &frame_ancestors)
        }
        Route::MediaFile(encoded_path) => {
            let encoded_path = encoded_path.to_string();
            serve_scoped_file(&encoded_path, request, policy.as_ref()).await
        }
        Route::NotFound => status_response(StatusCode::NOT_FOUND),
    };

    Ok(response)
}

/// `policy_for_request` is called per request so newly allowed song folders are picked up
/// without restarting the server.
async fn accept_loop<F>(listener: TcpListener, policy_for_request: F, frame_ancestors: Arc<String>)
where
    F: Fn() -> Arc<dyn PathPolicy> + Clone + Send + 'static,
{
    loop {
        let (stream, _addr) = match listener.accept().await {
            Ok(accepted) => accepted,
            Err(e) => {
                log::warn!("Error accepting connection: {}", e);
                continue;
            }
        };

        let policy_for_request = policy_for_request.clone();
        let frame_ancestors = frame_ancestors.clone();

        tokio::spawn(async move {
            let io = TokioIo::new(stream);
            let service = service_fn(move |request| {
                handle_request(request, policy_for_request(), frame_ancestors.clone())
            });

            if let Err(e) = http1::Builder::new().serve_connection(io, service).await {
                // Clients routinely drop connections, e.g. when a media element seeks.
                log::debug!("Error serving connection: {}", e);
            }
        });
    }
}

/// Binds the loopback listeners and starts serving on the current tokio runtime.
///
/// `frame_ancestors` lists the origins the app document can have (the packaged app scheme,
/// plus the Vite dev server in development); only they may frame the static assets. This
/// only needs to keep *remote* pages out, and the server is loopback-only regardless.
pub fn start(
    frame_ancestors: Vec<String>,
    policy: Arc<dyn PathPolicy>,
) -> Result<LocalServerState, String> {
    let (port, listeners) = bind_loopback_listeners(24000).ok_or("No available port found")?;

    // Advertise `localhost` rather than `127.0.0.1`: YouTube refuses to embed for an
    // origin of `http://127.0.0.1:*` (error 150) while allowing `http://localhost:*`.
    let config = LocalServerConfig {
        port,
        host: "localhost".to_string(),
    };

    let frame_ancestors = Arc::new(frame_ancestors.join(" "));

    log::info!("Local server listening on localhost:{}", port);

    // One task per bound address.
    for listener in listeners {
        listener
            .set_nonblocking(true)
            .map_err(|e| format!("Failed to set listener non-blocking: {e}"))?;
        // Adopting the listener registers it with the tokio reactor, so the caller must be
        // running inside the runtime.
        let listener =
            TcpListener::from_std(listener).map_err(|e| format!("Failed to adopt listener: {e}"))?;

        let policy = policy.clone();
        let policy_for_request = move || policy.clone();
        tokio::spawn(accept_loop(listener, policy_for_request, frame_ancestors.clone()));
    }

    Ok(LocalServerState::new(config))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Read, Write};
    use std::net::{SocketAddr, TcpStream};

    struct AllowAll;

    impl PathPolicy for AllowAll {
        fn is_allowed(&self, _path: &str) -> bool {
            true
        }
    }

    /// Starts the real server on a random port and returns its address.
    fn start_test_server() -> SocketAddr {
        let listener = StdTcpListener::bind((Ipv4Addr::LOCALHOST, 0)).expect("bind test listener");
        listener.set_nonblocking(true).expect("non-blocking");
        let addr = listener.local_addr().expect("listener address");

        std::thread::spawn(move || {
            let runtime = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .expect("test runtime");

            runtime.block_on(async move {
                let listener = TcpListener::from_std(listener).expect("adopt listener");
                let policy = move || Arc::new(AllowAll) as Arc<dyn PathPolicy>;
                accept_loop(listener, policy, Arc::new("'none'".to_string())).await;
            });
        });

        addr
    }

    /// Sends a raw request and returns the raw response, so header handling is exercised
    /// exactly as a browser would drive it.
    fn raw_request(addr: SocketAddr, request: &str) -> String {
        let mut stream = TcpStream::connect(addr).expect("connect to test server");
        stream
            .set_read_timeout(Some(std::time::Duration::from_secs(5)))
            .expect("read timeout");
        stream.write_all(request.as_bytes()).expect("write request");
        stream.flush().expect("flush request");

        let mut response = Vec::new();
        stream.read_to_end(&mut response).expect("read response");
        String::from_utf8_lossy(&response).to_string()
    }

    fn encode_path(path: &std::path::Path) -> String {
        percent_encoding::utf8_percent_encode(
            &path.to_string_lossy(),
            percent_encoding::NON_ALPHANUMERIC,
        )
        .to_string()
    }

    /// The bug this server was rewritten for: request headers were read into a fixed 4KB
    /// buffer with a single `read()`, so anything past 4KB was silently dropped. A `Range`
    /// header pushed beyond that cutoff by long preceding headers was ignored, and the
    /// server answered a seek with the entire file (200 instead of 206) — which for a large
    /// video means downloading it all to play from the middle.
    #[test]
    fn honours_a_range_header_pushed_past_the_old_4kb_read_buffer() {
        let dir = std::env::temp_dir().join(format!("tp-local-server-{}", std::process::id()));
        std::fs::create_dir_all(&dir).expect("create temp dir");
        let file_path = dir.join("song.mp3");
        let body: Vec<u8> = (0..10_000u32).map(|i| (i % 251) as u8).collect();
        std::fs::write(&file_path, &body).expect("write temp file");

        let addr = start_test_server();

        // Padding placed *before* the Range header, so a truncating parser loses the Range.
        let padding = "x".repeat(8000);
        let request = format!(
            "GET /media/{} HTTP/1.1\r\nHost: localhost\r\nX-Padding: {}\r\nRange: bytes=100-199\r\nConnection: close\r\n\r\n",
            encode_path(&file_path),
            padding
        );

        let response = raw_request(addr, &request);

        assert!(
            response.starts_with("HTTP/1.1 206"),
            "expected a partial response, got: {}",
            response.lines().next().unwrap_or_default()
        );
        assert!(
            response.contains("content-range: bytes 100-199/10000"),
            "expected the requested byte range, got headers: {}",
            response.split("\r\n\r\n").next().unwrap_or_default()
        );

        std::fs::remove_file(&file_path).ok();
    }

    /// Headers split across TCP writes must still parse; the old single `read()` could see
    /// only the first packet and mis-parse the request.
    #[test]
    fn parses_headers_that_arrive_in_separate_packets() {
        let addr = start_test_server();

        let mut stream = TcpStream::connect(addr).expect("connect to test server");
        stream
            .set_read_timeout(Some(std::time::Duration::from_secs(5)))
            .expect("read timeout");

        for chunk in [
            "GET /embed/youtube HTTP/1.1\r\n",
            "Host: localhost\r\n",
            "Connection: close\r\n",
            "\r\n",
        ] {
            stream.write_all(chunk.as_bytes()).expect("write chunk");
            stream.flush().expect("flush chunk");
            std::thread::sleep(std::time::Duration::from_millis(20));
        }

        let mut response = Vec::new();
        stream.read_to_end(&mut response).expect("read response");
        let response = String::from_utf8_lossy(&response);

        assert!(
            response.starts_with("HTTP/1.1 200"),
            "expected the embed page, got: {}",
            response.lines().next().unwrap_or_default()
        );
    }

    #[test]
    fn refuses_paths_outside_the_scope() {
        struct DenyAll;
        impl PathPolicy for DenyAll {
            fn is_allowed(&self, _path: &str) -> bool {
                false
            }
        }

        let listener = StdTcpListener::bind((Ipv4Addr::LOCALHOST, 0)).expect("bind test listener");
        listener.set_nonblocking(true).expect("non-blocking");
        let addr = listener.local_addr().expect("listener address");

        std::thread::spawn(move || {
            let runtime = tokio::runtime::Builder::new_current_thread()
                .enable_all()
                .build()
                .expect("test runtime");
            runtime.block_on(async move {
                let listener = TcpListener::from_std(listener).expect("adopt listener");
                let policy = move || Arc::new(DenyAll) as Arc<dyn PathPolicy>;
                accept_loop(listener, policy, Arc::new("'none'".to_string())).await;
            });
        });

        let response = raw_request(
            addr,
            "GET /media/%2Fetc%2Fpasswd HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n",
        );

        assert!(
            response.starts_with("HTTP/1.1 403"),
            "expected a forbidden response, got: {}",
            response.lines().next().unwrap_or_default()
        );
    }

    #[test]
    fn returns_404_for_unknown_paths_over_http() {
        let addr = start_test_server();
        let response = raw_request(
            addr,
            "GET /nope HTTP/1.1\r\nHost: localhost\r\nConnection: close\r\n\r\n",
        );

        assert!(
            response.starts_with("HTTP/1.1 404"),
            "expected a not-found response, got: {}",
            response.lines().next().unwrap_or_default()
        );
    }

    fn media_path(request_target: &str) -> Option<String> {
        match route(request_target) {
            Route::MediaFile(encoded) => Some(encoded.to_string()),
            _ => None,
        }
    }

    #[test]
    fn serves_the_embed_page_as_html() {
        assert!(matches!(
            route("/embed/youtube"),
            Route::StaticAsset("text/html; charset=utf-8", _)
        ));
    }

    #[test]
    fn routes_media_paths_to_the_file_handler() {
        assert_eq!(
            media_path("/media/%2Ftmp%2Fsong.mp3").as_deref(),
            Some("%2Ftmp%2Fsong.mp3")
        );
    }

    #[test]
    fn rejects_unknown_paths() {
        assert_eq!(route("/"), Route::NotFound);
        assert_eq!(route("/nope"), Route::NotFound);
        // The pre-refactor route, to catch a partial revert.
        assert_eq!(route("/youtube-player"), Route::NotFound);
    }

    /// The whole point of the prefixes: a song path can no longer shadow an asset route,
    /// and files outside `/media/` are never reachable.
    #[test]
    fn namespaces_keep_song_paths_from_reaching_asset_routes() {
        assert_eq!(route("/embed/youtube/../secret"), Route::NotFound);

        // A song whose encoded path begins with an asset route name still routes to media.
        assert_eq!(
            media_path("/media/embed%2Fyoutube").as_deref(),
            Some("embed%2Fyoutube")
        );

        // Unprefixed song paths, the old URL shape, are no longer served.
        assert_eq!(route("/%2Ftmp%2Fsong.mp3"), Route::NotFound);
    }

    /// `localhost` may resolve to either loopback address, so the server must answer on
    /// every one it can bind — otherwise the advertised host intermittently refuses.
    #[test]
    fn binds_every_loopback_address_on_one_port() {
        let (port, listeners) = bind_loopback_listeners(24500).expect("should bind a port");

        let bound: Vec<IpAddr> = listeners
            .iter()
            .map(|l| l.local_addr().expect("listener has an address").ip())
            .collect();

        assert!(bound.contains(&IpAddr::V4(Ipv4Addr::LOCALHOST)));

        for listener in &listeners {
            assert_eq!(
                listener
                    .local_addr()
                    .expect("listener has an address")
                    .port(),
                port,
                "all listeners must share the advertised port"
            );
        }

        // IPv6 is only expected where the host supports it.
        if StdTcpListener::bind((Ipv6Addr::LOCALHOST, 0)).is_ok() {
            assert!(bound.contains(&IpAddr::V6(Ipv6Addr::LOCALHOST)));
        }
    }

    /// Song URLs must carry the prefix the router matches on, or every local song 404s.
    #[test]
    fn media_base_url_matches_the_route_prefix() {
        let state = LocalServerState::new(LocalServerConfig {
            port: 24000,
            host: "localhost".to_string(),
        });

        assert_eq!(state.get_base_url(), "http://localhost:24000");
        assert_eq!(state.get_media_base_url(), "http://localhost:24000/media");

        // The URL builder joins with `/`, so the result must match MEDIA_PREFIX exactly.
        let song_url = format!("{}/{}", state.get_media_base_url(), "song.mp3");
        assert_eq!(song_url, "http://localhost:24000/media/song.mp3");
        assert!(matches!(
            route(song_url.trim_start_matches("http://localhost:24000")),
            Route::MediaFile("song.mp3")
        ));
    }
}
