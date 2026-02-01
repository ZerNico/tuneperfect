import { orpcClient } from "../orpc";

let cachedIceServers: RTCIceServer[] | null = null;

export async function getIceServers(): Promise<RTCIceServer[]> {
  if (cachedIceServers) {
    return cachedIceServers;
  }

  try {
    cachedIceServers = await orpcClient.webrtc.getIceServers();
    return cachedIceServers;
  } catch (error) {
    console.warn("[WebRTC] Failed to fetch ICE servers from API, using fallback:", error);
    return [{ urls: "stun:stun.l.google.com:19302" }];
  }
}

export function clearIceServersCache() {
  cachedIceServers = null;
}
