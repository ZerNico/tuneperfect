import { createSignal } from "solid-js";
import type { SongSummary } from "~/lib/webrtc/types";

function createSongsStore() {
  // Songs received from the game client via WebRTC
  const [songs, setSongs] = createSignal<SongSummary[]>([]);

  // WebRTC connection state
  const [connectionState, setConnectionState] = createSignal<RTCPeerConnectionState>("new");

  // Whether we're currently attempting to connect
  const [isConnecting, setIsConnecting] = createSignal(false);

  // Error message if connection failed
  const [error, setError] = createSignal<string | null>(null);

  // Reset the store
  const reset = () => {
    setSongs([]);
    setConnectionState("new");
    setIsConnecting(false);
    setError(null);
  };

  return {
    songs,
    setSongs,
    connectionState,
    setConnectionState,
    isConnecting,
    setIsConnecting,
    error,
    setError,
    reset,
  };
}

export const songsStore = createSongsStore();
