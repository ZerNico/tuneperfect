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

  iceServers: {
    /**
     * TURN credentials from the API can open relays for 24 h; refetching after an hour gives every
     * new connection (and ICE restart) at least 23 h of them.
     */
    maxAge: 60 * 60_000,
    /** When a refetch fails, servers this old still carry working credentials: better than STUN only. */
    staleMaxAge: 12 * 60 * 60_000,
  },

  heartbeat: {
    interval: 15_000,
    timeout: 5_000,
  },

  channels: {
    gameRpc: "game-rpc",
    /**
     * Small, urgent calls (ping, remote control), so they don't wait behind song lists and covers on
     * `gameRpc`. Phones only use it once the game lists `CONTROL_CHANNEL_FEATURE` in `ping`.
     */
    gameControl: "game-control",
  },
} as const;

export type WebRTCConfig = typeof WEBRTC_CONFIG;
