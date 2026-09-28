use std::collections::HashMap;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::AppHandle;
use tauri_specta::Event;
use tokio::sync::{watch, Mutex};
use webrtc::data_channel::{DataChannel, DataChannelEvent};
use webrtc::peer_connection::{
    register_default_interceptors, MediaEngine, PeerConnection, PeerConnectionBuilder,
    PeerConnectionEventHandler, RTCConfigurationBuilder, RTCIceCandidateInit, RTCIceServer,
    RTCPeerConnectionIceEvent, RTCPeerConnectionState, RTCSessionDescription, Registry,
};

#[derive(Serialize, Deserialize, Debug, Clone, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct IceCandidateEvent {
    pub user_id: String,
    pub candidate: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct ConnectionStateEvent {
    pub user_id: String,
    pub state: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct ChannelOpenEvent {
    pub user_id: String,
    pub label: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct ChannelCloseEvent {
    pub user_id: String,
    pub label: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Type, Event)]
#[serde(rename_all = "camelCase")]
pub struct ChannelMessageEvent {
    pub user_id: String,
    pub label: String,
    pub data: String,
}

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
#[serde(rename_all = "camelCase")]
pub struct IceServerConfig {
    pub urls: IceServerUrls,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub username: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub credential: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone, Type)]
#[serde(untagged)]
pub enum IceServerUrls {
    Single(String),
    Multiple(Vec<String>),
}

impl IceServerConfig {
    pub fn to_rtc_ice_server(&self) -> RTCIceServer {
        let urls = match &self.urls {
            IceServerUrls::Single(url) => vec![url.clone()],
            IceServerUrls::Multiple(urls) => urls.clone(),
        };

        RTCIceServer {
            urls,
            username: self.username.clone().unwrap_or_default(),
            credential: self.credential.clone().unwrap_or_default(),
        }
    }
}

/// State shared between a peer's handle, its event handler and its data channel tasks.
struct PeerContext {
    user_id: String,
    handle: AppHandle,
    data_channels: Mutex<HashMap<String, Arc<dyn DataChannel>>>,
    /// Flipped to `true` when the host closes the peer. Data channel tasks stop on it,
    /// since `DataChannel::poll` is not guaranteed to return once the connection is gone.
    closed: watch::Sender<bool>,
}

impl PeerContext {
    fn emit_channel_close(&self, label: String) {
        log::debug!(
            "[WebRTC] Data channel '{label}' closed for user {}",
            self.user_id
        );
        let _ = ChannelCloseEvent {
            user_id: self.user_id.clone(),
            label,
        }
        .emit(&self.handle);
    }

    /// Stops all data channel tasks and emits the close events right away, so they reach the
    /// frontend before a replacement connection for the same user can open its channels.
    async fn close(&self) {
        self.closed.send_replace(true);
        let labels: Vec<String> = self
            .data_channels
            .lock()
            .await
            .drain()
            .map(|(label, _)| label)
            .collect();
        for label in labels {
            self.emit_channel_close(label);
        }
    }

    async fn run_data_channel(self: Arc<Self>, dc: Arc<dyn DataChannel>) {
        let uid = &self.user_id;
        let label = match dc.label().await {
            Ok(label) => label,
            Err(e) => {
                log::warn!("[WebRTC] Failed to read data channel label for user {uid}: {e}");
                return;
            }
        };
        log::debug!("[WebRTC] Data channel '{label}' created for user {uid}");

        let mut closed = self.closed.subscribe();
        {
            // Checked under the lock so a concurrent `close` can't miss this channel.
            let mut channels = self.data_channels.lock().await;
            if *closed.borrow() {
                return;
            }
            channels.insert(label.clone(), Arc::clone(&dc));
        }

        loop {
            let event = tokio::select! {
                biased;
                _ = closed.wait_for(|closed| *closed) => return,
                event = dc.poll() => event,
            };

            match event {
                Some(DataChannelEvent::OnOpen) => {
                    log::debug!("[WebRTC] Data channel '{label}' opened for user {uid}");
                    let _ = ChannelOpenEvent {
                        user_id: uid.clone(),
                        label: label.clone(),
                    }
                    .emit(&self.handle);
                }
                Some(DataChannelEvent::OnMessage(msg)) => {
                    let data = String::from_utf8(msg.data.to_vec()).unwrap_or_default();
                    let _ = ChannelMessageEvent {
                        user_id: uid.clone(),
                        label: label.clone(),
                        data,
                    }
                    .emit(&self.handle);
                }
                Some(DataChannelEvent::OnClose) | None => break,
                Some(_) => {}
            }
        }

        // Only emit if `close` hasn't already drained (and announced) this channel.
        let removed = {
            let mut channels = self.data_channels.lock().await;
            match channels.get(&label) {
                Some(current) if Arc::ptr_eq(current, &dc) => channels.remove(&label).is_some(),
                _ => false,
            }
        };
        if removed {
            self.emit_channel_close(label);
        }
    }
}

struct PeerHandler {
    ctx: Arc<PeerContext>,
}

#[async_trait::async_trait]
impl PeerConnectionEventHandler for PeerHandler {
    async fn on_ice_candidate(&self, event: RTCPeerConnectionIceEvent) {
        let json = match event.candidate.to_json() {
            Ok(init) => serde_json::to_string(&init).unwrap_or_default(),
            Err(_) => return,
        };
        let _ = IceCandidateEvent {
            user_id: self.ctx.user_id.clone(),
            candidate: json,
        }
        .emit(&self.ctx.handle);
    }

    async fn on_connection_state_change(&self, state: RTCPeerConnectionState) {
        let uid = &self.ctx.user_id;
        let state_str = match state {
            RTCPeerConnectionState::New => "new",
            RTCPeerConnectionState::Connecting => "connecting",
            RTCPeerConnectionState::Connected => "connected",
            RTCPeerConnectionState::Disconnected => "disconnected",
            RTCPeerConnectionState::Failed => "failed",
            RTCPeerConnectionState::Closed => "closed",
            _ => "unknown",
        };
        log::info!("[WebRTC] Connection state for {uid}: {state_str}");
        let _ = ConnectionStateEvent {
            user_id: uid.clone(),
            state: state_str.to_string(),
        }
        .emit(&self.ctx.handle);
    }

    async fn on_data_channel(&self, dc: Arc<dyn DataChannel>) {
        tauri::async_runtime::spawn(Arc::clone(&self.ctx).run_data_channel(dc));
    }
}

pub struct PeerState {
    pc: Arc<dyn PeerConnection>,
    ctx: Arc<PeerContext>,
}

impl PeerState {
    pub async fn add_ice_candidate(&self, candidate_json: &str) -> Result<(), String> {
        let candidate: RTCIceCandidateInit = serde_json::from_str(candidate_json)
            .map_err(|e| format!("Invalid ICE candidate JSON: {e}"))?;

        self.pc
            .add_ice_candidate(candidate)
            .await
            .map_err(|e| format!("Failed to add ICE candidate: {e}"))?;

        Ok(())
    }

    pub async fn send_message(&self, label: &str, data: &str) -> Result<(), String> {
        let dc = {
            let channels = self.ctx.data_channels.lock().await;
            channels
                .get(label)
                .cloned()
                .ok_or_else(|| format!("No data channel '{label}'"))?
        };

        // SCTP has a max message size (default ~64KB in webrtc-rs).
        // Messages under the limit are sent directly; larger ones are chunked
        // with a simple header protocol so the receiver can reassemble.
        const MAX_CHUNK_SIZE: usize = 48_000;

        if data.len() <= MAX_CHUNK_SIZE {
            dc.send_text(data)
                .await
                .map_err(|e| format!("Failed to send message on '{label}': {e}"))?;
        } else {
            let chunk_id = std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_nanos();

            let chunks = split_at_char_boundaries(data, MAX_CHUNK_SIZE);
            let total = chunks.len();

            for (i, chunk) in chunks.iter().enumerate() {
                let msg = format!("\x01CHUNK:{chunk_id}:{i}:{total}\n{chunk}");
                dc.send_text(&msg).await.map_err(|e| {
                    format!("Failed to send chunk {}/{total} on '{label}': {e}", i + 1)
                })?;
            }
        }

        Ok(())
    }

    async fn close(&self) {
        let _ = self.pc.close().await;
        self.ctx.close().await;
    }
}

/// Splits `data` into chunks of at most `max_bytes` bytes without cutting through a
/// multi-byte UTF-8 character, so every chunk is valid text on its own.
fn split_at_char_boundaries(data: &str, max_bytes: usize) -> Vec<&str> {
    let mut chunks = Vec::new();
    let mut rest = data;
    while !rest.is_empty() {
        let mut end = max_bytes.min(rest.len());
        while !rest.is_char_boundary(end) {
            end -= 1;
        }
        if end == 0 {
            // `max_bytes` is smaller than the next character; send it whole.
            end = rest.chars().next().map_or(rest.len(), char::len_utf8);
        }
        let (chunk, tail) = rest.split_at(end);
        chunks.push(chunk);
        rest = tail;
    }
    chunks
}

pub struct WebRTCHost {
    peers: HashMap<String, Arc<PeerState>>,
}

impl WebRTCHost {
    pub fn new() -> Self {
        Self {
            peers: HashMap::new(),
        }
    }

    pub async fn create_answer(
        &mut self,
        user_id: String,
        offer_sdp: String,
        ice_servers: Vec<IceServerConfig>,
        app_handle: AppHandle,
    ) -> Result<String, String> {
        if let Some(old) = self.peers.remove(&user_id) {
            log::info!("[WebRTC] Closing existing connection for user {user_id}");
            old.close().await;
        }

        log::info!("[WebRTC] Creating peer connection for user {user_id}");

        let config = RTCConfigurationBuilder::new()
            .with_ice_servers(ice_servers.iter().map(|s| s.to_rtc_ice_server()).collect())
            .build();

        let mut media_engine = MediaEngine::default();
        media_engine
            .register_default_codecs()
            .map_err(|e| format!("Failed to register codecs: {e}"))?;

        let registry = register_default_interceptors(Registry::new(), &mut media_engine)
            .map_err(|e| format!("Failed to register interceptors: {e}"))?;

        let (closed, _) = watch::channel(false);
        let ctx = Arc::new(PeerContext {
            user_id: user_id.clone(),
            handle: app_handle,
            data_channels: Mutex::new(HashMap::new()),
            closed,
        });

        let pc = PeerConnectionBuilder::new()
            .with_configuration(config)
            .with_media_engine(media_engine)
            .with_interceptor_registry(registry)
            .with_handler(Arc::new(PeerHandler {
                ctx: Arc::clone(&ctx),
            }))
            // Wildcard: one socket per local IPv4 interface, each on an ephemeral port.
            .with_udp_addrs(vec!["0.0.0.0:0"])
            .build()
            .await
            .map_err(|e| format!("Failed to create peer connection: {e}"))?;
        let pc: Arc<dyn PeerConnection> = Arc::new(pc);
        let peer = PeerState { pc, ctx };

        let answer_sdp = match Self::negotiate(&peer.pc, offer_sdp).await {
            Ok(sdp) => sdp,
            Err(e) => {
                peer.close().await;
                return Err(e);
            }
        };

        self.peers.insert(user_id, Arc::new(peer));

        Ok(answer_sdp)
    }

    async fn negotiate(pc: &Arc<dyn PeerConnection>, offer_sdp: String) -> Result<String, String> {
        let offer = RTCSessionDescription::offer(offer_sdp)
            .map_err(|e| format!("Invalid offer SDP: {e}"))?;
        pc.set_remote_description(offer)
            .await
            .map_err(|e| format!("Failed to set remote description: {e}"))?;

        let answer = pc
            .create_answer(None)
            .await
            .map_err(|e| format!("Failed to create answer: {e}"))?;
        let answer_sdp = answer.sdp.clone();
        pc.set_local_description(answer)
            .await
            .map_err(|e| format!("Failed to set local description: {e}"))?;

        Ok(answer_sdp)
    }

    pub fn get_peer(&self, user_id: &str) -> Result<Arc<PeerState>, String> {
        self.peers
            .get(user_id)
            .cloned()
            .ok_or_else(|| format!("No peer connection for user {user_id}"))
    }

    pub async fn close_connection(&mut self, user_id: &str) {
        if let Some(peer) = self.peers.remove(user_id) {
            log::info!("[WebRTC] Closing connection for user {user_id}");
            peer.close().await;
        }
    }

    pub async fn close_all(&mut self) {
        log::info!("[WebRTC] Closing all connections");
        for (_, peer) in self.peers.drain() {
            peer.close().await;
        }
    }
}

pub type SharedWebRTCHost = Arc<Mutex<WebRTCHost>>;

pub fn create_shared_host() -> SharedWebRTCHost {
    Arc::new(Mutex::new(WebRTCHost::new()))
}

#[cfg(test)]
mod tests {
    use super::split_at_char_boundaries;

    #[test]
    fn splits_ascii_at_exact_size() {
        assert_eq!(split_at_char_boundaries("abcdefg", 3), ["abc", "def", "g"]);
    }

    #[test]
    fn never_cuts_multi_byte_characters() {
        // "ü" is 2 bytes, so a 3-byte limit would land mid-character every time.
        let data = "üüüüü";
        let chunks = split_at_char_boundaries(data, 3);
        assert_eq!(chunks, ["ü", "ü", "ü", "ü", "ü"]);
        assert_eq!(chunks.concat(), data);
    }

    #[test]
    fn roundtrips_large_mixed_text() {
        let data = "Beyoncé – Déjà Vu 🎤 ".repeat(5_000);
        let chunks = split_at_char_boundaries(&data, 48_000);
        assert!(chunks.iter().all(|c| c.len() <= 48_000));
        assert_eq!(chunks.concat(), data);
    }

    #[test]
    fn keeps_a_character_wider_than_the_limit() {
        assert_eq!(split_at_char_boundaries("🎤a", 2), ["🎤", "a"]);
    }

    #[test]
    fn empty_input_has_no_chunks() {
        assert!(split_at_char_boundaries("", 10).is_empty());
    }
}
