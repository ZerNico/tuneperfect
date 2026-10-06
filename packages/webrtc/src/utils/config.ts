export const WEBRTC_CONFIG = {
  connectionTimeout: 30_000,

  reconnect: {
    initialDelay: 2_000,
    maxDelay: 64_000,
    maxAttemptsBeforeToast: 3,
    /** After this many failed attempts in a row the phone stops and offers a retry button instead. */
    maxAttempts: 8,
    /** A `disconnected` connection often recovers by itself; after this long the phone tries an ICE restart. */
    disconnectedGrace: 4_000,
  },

  heartbeat: {
    interval: 15_000,
    timeout: 5_000,
  },

  channels: {
    gameRpc: "game-rpc",
  },
} as const;

export type WebRTCConfig = typeof WEBRTC_CONFIG;
