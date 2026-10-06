import { WEBRTC_CONFIG } from "./config";

/** Used when the API can't be reached: enough for phones on the same network as the game. */
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

/** Credentials this close to their expiry count as expired: a connection still has to start with them. */
const EXPIRY_MARGIN = 5 * 60_000;

/**
 * When the servers' TURN credentials stop opening relays. They're coturn REST credentials, whose
 * username starts with its expiry in unix seconds; servers without one never expire.
 */
export function credentialsExpireAt(servers: RTCIceServer[]): number {
  let expiresAt = Number.POSITIVE_INFINITY;
  for (const server of servers) {
    const expiry = /^(\d+):/.exec(server.username ?? "")?.[1];
    if (expiry) expiresAt = Math.min(expiresAt, Number(expiry) * 1000);
  }
  return expiresAt;
}

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
 * falls back to the last servers while they're under `staleMaxAge` and their credentials still
 * work, then to a public STUN server. `invalidate` forces the next call to load again (e.g. after a
 * failed connection: the TURN secret may have been rotated).
 */
export function createIceServerSource(
  load: () => Promise<RTCIceServer[]>,
  {
    maxAge = WEBRTC_CONFIG.iceServers.maxAge,
    staleMaxAge = WEBRTC_CONFIG.iceServers.staleMaxAge,
    now = Date.now,
  }: IceServerSourceOptions = {},
) {
  let cached: { servers: RTCIceServer[]; loadedAt: number; expiresAt: number; invalidated: boolean } | null = null;
  let pending: Promise<RTCIceServer[]> | null = null;

  // A clock that went backwards counts as stale; credentials about to expire never count as usable.
  const age = () => (cached ? now() - cached.loadedAt : Number.POSITIVE_INFINITY);
  const usableFor = (maxAgeMs: number) =>
    cached !== null && age() >= 0 && age() < maxAgeMs && now() < cached.expiresAt - EXPIRY_MARGIN;

  const refresh = async (): Promise<RTCIceServer[]> => {
    // Measured from the request: the credentials' lifetime started on the server by then.
    const loadedAt = now();
    try {
      const servers = await load();
      cached = { servers, loadedAt, expiresAt: credentialsExpireAt(servers), invalidated: false };
      return servers;
    } catch (error) {
      if (cached && usableFor(staleMaxAge)) return cached.servers;
      console.warn("[WebRTC] Failed to fetch ICE servers from the API, using a public STUN server:", error);
      return FALLBACK_ICE_SERVERS;
    }
  };

  const get = async (): Promise<RTCIceServer[]> => {
    if (cached && !cached.invalidated && usableFor(maxAge)) return cached.servers;
    // Reset on the outer promise: inside `refresh` it could run before the assignment.
    pending ??= refresh().finally(() => {
      pending = null;
    });
    return pending;
  };

  return Object.assign(get, {
    /** The next call loads again; the current servers stay as a fallback if that fails. */
    invalidate: () => {
      if (cached) cached.invalidated = true;
    },
  });
}
