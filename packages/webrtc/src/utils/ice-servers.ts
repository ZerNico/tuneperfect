import { WEBRTC_CONFIG } from "./config";

/** Used when the API can't be reached: enough for phones on the same network as the game. */
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

export interface IceServerSourceOptions {
  maxAge?: number;
  staleMaxAge?: number;
  /**
   * Wall-clock time, not `performance.now()`: the monotonic clock pauses while a phone sleeps,
   * which would make expired TURN credentials look fresh.
   */
  now?: () => number;
}

/**
 * Loads the ICE servers (STUN and TURN) and keeps them for `maxAge`, so TURN credentials (which
 * expire) are fresh for every new connection. Concurrent calls share one request. A failed load
 * falls back to the last servers while they're under `staleMaxAge`, then to a public STUN server.
 */
export function createIceServerSource(
  load: () => Promise<RTCIceServer[]>,
  {
    maxAge = WEBRTC_CONFIG.iceServers.maxAge,
    staleMaxAge = WEBRTC_CONFIG.iceServers.staleMaxAge,
    now = Date.now,
  }: IceServerSourceOptions = {},
) {
  let cached: { servers: RTCIceServer[]; loadedAt: number } | null = null;
  let pending: Promise<RTCIceServer[]> | null = null;

  // A clock that went backwards counts as stale.
  const age = () => (cached ? now() - cached.loadedAt : Number.POSITIVE_INFINITY);
  const isFresh = () => age() >= 0 && age() < maxAge;

  const refresh = async (): Promise<RTCIceServer[]> => {
    // Measured from the request: the credentials' lifetime started on the server by then.
    const loadedAt = now();
    try {
      const servers = await load();
      cached = { servers, loadedAt };
      return servers;
    } catch (error) {
      if (cached && age() >= 0 && age() < staleMaxAge) return cached.servers;
      console.warn("[WebRTC] Failed to fetch ICE servers from the API, using a public STUN server:", error);
      return FALLBACK_ICE_SERVERS;
    }
  };

  return async (): Promise<RTCIceServer[]> => {
    if (cached && isFresh()) return cached.servers;
    // Reset on the outer promise: inside `refresh` it could run before the assignment.
    pending ??= refresh().finally(() => {
      pending = null;
    });
    return pending;
  };
}
