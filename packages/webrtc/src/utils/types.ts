export interface ConnectionCallbacks {
  onIceCandidate: (candidate: string) => void;
  onConnectionStateChange: (state: RTCPeerConnectionState) => void;
  onDataChannelOpen: () => void;
}

export interface DataChannelHandlers {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: (event: Event) => void;
  onMessage?: (data: unknown) => void;
}

export interface DataChannelSetupResult {
  cleanup: () => void;
}

export interface HeartbeatOptions {
  interval?: number;
  timeout?: number;
  onFailure?: () => void;
}

export type GoodbyeReason = "user_left" | "lobby_closed" | "timeout" | "error";
