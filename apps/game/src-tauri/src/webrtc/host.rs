use std::collections::HashMap;
use std::sync::Arc;

use serde::{Deserialize, Serialize};
use specta::Type;
use tauri::AppHandle;
use tauri_specta::Event;
use tokio::sync::Mutex;
use webrtc::api::interceptor_registry::register_default_interceptors;
use webrtc::api::media_engine::MediaEngine;
use webrtc::api::APIBuilder;
use webrtc::data_channel::data_channel_message::DataChannelMessage;
use webrtc::data_channel::RTCDataChannel;
use webrtc::ice_transport::ice_candidate::RTCIceCandidateInit;
use webrtc::ice_transport::ice_credential_type::RTCIceCredentialType;
use webrtc::ice_transport::ice_server::RTCIceServer;
use webrtc::interceptor::registry::Registry;
use webrtc::peer_connection::configuration::RTCConfiguration;
use webrtc::peer_connection::peer_connection_state::RTCPeerConnectionState;
use webrtc::peer_connection::sdp::session_description::RTCSessionDescription;
use webrtc::peer_connection::RTCPeerConnection;

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

        let has_credentials = self.username.is_some() && self.credential.is_some();

        RTCIceServer {
            urls,
            username: self.username.clone().unwrap_or_default(),
            credential: self.credential.clone().unwrap_or_default(),
            credential_type: if has_credentials {
                RTCIceCredentialType::Password
            } else {
                RTCIceCredentialType::Unspecified
            },
        }
    }
}

pub struct PeerState {
    pc: Arc<RTCPeerConnection>,
    data_channels: Arc<Mutex<HashMap<String, Arc<RTCDataChannel>>>>,
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
        let channels = self.data_channels.lock().await;
        let dc = channels
            .get(label)
            .ok_or_else(|| format!("No data channel '{label}'"))?;

        dc.send_text(data.to_string())
            .await
            .map_err(|e| format!("Failed to send message on '{label}': {e}"))?;

        Ok(())
    }
}

fn setup_ice_candidate_callback(pc: &Arc<RTCPeerConnection>, user_id: &str, handle: &AppHandle) {
    let uid = user_id.to_string();
    let handle = handle.clone();
    pc.on_ice_candidate(Box::new(move |candidate| {
        let uid = uid.clone();
        let handle = handle.clone();
        Box::pin(async move {
            if let Some(c) = candidate {
                let json = match c.to_json() {
                    Ok(init) => serde_json::to_string(&init).unwrap_or_default(),
                    Err(_) => return,
                };
                let _ = IceCandidateEvent {
                    user_id: uid,
                    candidate: json,
                }
                .emit(&handle);
            }
        })
    }));
}

fn setup_connection_state_callback(
    pc: &Arc<RTCPeerConnection>,
    user_id: &str,
    handle: &AppHandle,
) {
    let uid = user_id.to_string();
    let handle = handle.clone();
    pc.on_peer_connection_state_change(Box::new(move |state| {
        let uid = uid.clone();
        let handle = handle.clone();
        Box::pin(async move {
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
                user_id: uid,
                state: state_str.to_string(),
            }
            .emit(&handle);
        })
    }));
}

fn setup_data_channel_callback(
    pc: &Arc<RTCPeerConnection>,
    user_id: &str,
    handle: &AppHandle,
    data_channels: &Arc<Mutex<HashMap<String, Arc<RTCDataChannel>>>>,
) {
    let uid = user_id.to_string();
    let handle = handle.clone();
    let channels = Arc::clone(data_channels);
    pc.on_data_channel(Box::new(move |dc: Arc<RTCDataChannel>| {
        let uid = uid.clone();
        let handle = handle.clone();
        let channels = Arc::clone(&channels);
        Box::pin(async move {
            let label = dc.label().to_string();
            log::debug!("[WebRTC] Data channel '{label}' created for user {uid}");

            {
                let mut ch = channels.lock().await;
                ch.insert(label.clone(), Arc::clone(&dc));
            }

            {
                let uid = uid.clone();
                let label = label.clone();
                let handle = handle.clone();
                dc.on_open(Box::new(move || {
                    let uid = uid.clone();
                    let label = label.clone();
                    let handle = handle.clone();
                    Box::pin(async move {
                        log::debug!("[WebRTC] Data channel '{label}' opened for user {uid}");
                        let _ = ChannelOpenEvent {
                            user_id: uid,
                            label,
                        }
                        .emit(&handle);
                    })
                }));
            }

            {
                let uid = uid.clone();
                let label = label.clone();
                let handle = handle.clone();
                let channels_close = Arc::clone(&channels);
                dc.on_close(Box::new(move || {
                    let uid = uid.clone();
                    let label = label.clone();
                    let handle = handle.clone();
                    let channels_close = Arc::clone(&channels_close);
                    Box::pin(async move {
                        log::debug!("[WebRTC] Data channel '{label}' closed for user {uid}");
                        {
                            let mut ch = channels_close.lock().await;
                            ch.remove(&label);
                        }
                        let _ = ChannelCloseEvent {
                            user_id: uid,
                            label,
                        }
                        .emit(&handle);
                    })
                }));
            }

            {
                let uid = uid.clone();
                let label = label.clone();
                let handle = handle.clone();
                dc.on_message(Box::new(move |msg: DataChannelMessage| {
                    let uid = uid.clone();
                    let label = label.clone();
                    let handle = handle.clone();
                    Box::pin(async move {
                        let data = String::from_utf8(msg.data.to_vec()).unwrap_or_default();
                        let _ = ChannelMessageEvent {
                            user_id: uid,
                            label,
                            data,
                        }
                        .emit(&handle);
                    })
                }));
            }
        })
    }));
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
            let _ = old.pc.close().await;
        }

        log::info!("[WebRTC] Creating peer connection for user {user_id}");

        let config = RTCConfiguration {
            ice_servers: ice_servers.iter().map(|s| s.to_rtc_ice_server()).collect(),
            ..Default::default()
        };

        let mut media_engine = MediaEngine::default();
        media_engine
            .register_default_codecs()
            .map_err(|e| format!("Failed to register codecs: {e}"))?;

        let mut registry = Registry::new();
        registry = register_default_interceptors(registry, &mut media_engine)
            .map_err(|e| format!("Failed to register interceptors: {e}"))?;

        let api = APIBuilder::new()
            .with_media_engine(media_engine)
            .with_interceptor_registry(registry)
            .build();

        let pc = api
            .new_peer_connection(config)
            .await
            .map_err(|e| format!("Failed to create peer connection: {e}"))?;
        let pc = Arc::new(pc);

        let data_channels: Arc<Mutex<HashMap<String, Arc<RTCDataChannel>>>> =
            Arc::new(Mutex::new(HashMap::new()));

        setup_ice_candidate_callback(&pc, &user_id, &app_handle);
        setup_connection_state_callback(&pc, &user_id, &app_handle);
        setup_data_channel_callback(&pc, &user_id, &app_handle, &data_channels);

        let offer = RTCSessionDescription::offer(offer_sdp)
            .map_err(|e| format!("Invalid offer SDP: {e}"))?;
        pc.set_remote_description(offer)
            .await
            .map_err(|e| format!("Failed to set remote description: {e}"))?;

        let answer = pc
            .create_answer(None)
            .await
            .map_err(|e| format!("Failed to create answer: {e}"))?;
        pc.set_local_description(answer.clone())
            .await
            .map_err(|e| format!("Failed to set local description: {e}"))?;

        let answer_sdp = answer.sdp;

        self.peers.insert(
            user_id,
            Arc::new(PeerState {
                pc,
                data_channels,
            }),
        );

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
            let _ = peer.pc.close().await;
        }
    }

    pub async fn close_all(&mut self) {
        log::info!("[WebRTC] Closing all connections");
        for (_, peer) in self.peers.drain() {
            let _ = peer.pc.close().await;
        }
    }
}

pub type SharedWebRTCHost = Arc<Mutex<WebRTCHost>>;

pub fn create_shared_host() -> SharedWebRTCHost {
    Arc::new(Mutex::new(WebRTCHost::new()))
}
