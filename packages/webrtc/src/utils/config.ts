export const WEBRTC_CONFIG = {
  connectionTimeout: 30_000,

  reconnect: {
    initialDelay: 2_000,
    maxDelay: 64_000,
    maxAttemptsBeforeToast: 3,
    waitForConnectionBuffer: 5_000,
  },

  heartbeat: {
    interval: 15_000,
    timeout: 5_000,
  },

  channels: {
    gameRpc: "game-rpc",
    appRpc: "app-rpc",
  },
} as const;

export type WebRTCConfig = typeof WEBRTC_CONFIG;
