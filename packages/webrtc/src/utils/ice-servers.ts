/** Used when the API can't be reached: enough for phones on the same network as the game. */
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

/** Loads the ICE servers (STUN and TURN) once and keeps them; falls back to a public STUN server on failure. */
export function createIceServerSource(load: () => Promise<RTCIceServer[]>) {
  let cached: RTCIceServer[] | null = null;
  return async (): Promise<RTCIceServer[]> => {
    if (cached) return cached;
    try {
      cached = await load();
      return cached;
    } catch (error) {
      console.warn("[WebRTC] Failed to fetch ICE servers from the API, using a public STUN server:", error);
      return FALLBACK_ICE_SERVERS;
    }
  };
}
