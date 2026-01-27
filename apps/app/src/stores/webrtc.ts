import { orpcClient } from "~/lib/orpc";
import { createGuestConnection, type GuestConnection } from "~/lib/webrtc/guest-connection";
import { songsStore } from "./songs";

// Singleton connection state
let connection: GuestConnection | null = null;
let signalAbortController: AbortController | null = null;

/**
 * Connect to the game client host via WebRTC
 * @param userId The current user's ID (needed for signaling)
 */
export async function connectToHost(userId: string): Promise<void> {
  // Don't reconnect if already connected or connecting
  if (songsStore.isConnecting() || songsStore.connectionState() === "connected") {
    console.log("[WebRTC] Already connected or connecting");
    return;
  }

  songsStore.setIsConnecting(true);
  songsStore.setError(null);

  try {
    // Create the connection
    connection = createGuestConnection({
      onIceCandidate: async (candidate) => {
        try {
          await orpcClient.signaling.sendSignal({
            signal: {
              type: "ice-candidate",
              candidate,
              from: userId,
            },
          });
        } catch (error) {
          console.error("[WebRTC] Failed to send ICE candidate:", error);
        }
      },
      onConnectionStateChange: (state) => {
        songsStore.setConnectionState(state);

        if (state === "connected") {
          songsStore.setIsConnecting(false);
        } else if (state === "disconnected" || state === "failed" || state === "closed") {
          songsStore.setIsConnecting(false);
          if (state === "failed") {
            songsStore.setError("Connection failed");
          }
        }
      },
      onSongs: (songs) => {
        songsStore.setSongs(songs);
      },
    });

    // Start listening for signals from the host
    signalAbortController = new AbortController();

    // Create and send offer
    const offerSdp = await connection.createOffer();
    console.log("[WebRTC] Created offer, sending to host");

    await orpcClient.signaling.sendSignal({
      signal: {
        type: "offer",
        sdp: offerSdp,
        from: userId,
      },
    });

    // Subscribe to signals from the host (answer and ICE candidates)
    const iterator = await orpcClient.signaling.subscribeAsGuest(undefined, {
      signal: signalAbortController.signal,
    });

    console.log("[WebRTC] Subscribed to signaling, waiting for answer");

    // Process incoming signals
    for await (const signal of iterator) {
      if (signalAbortController.signal.aborted) break;

      console.log("[WebRTC] Received signal:", signal.type);

      if (signal.type === "answer" && connection) {
        await connection.setAnswer(signal.sdp);
      } else if (signal.type === "ice-candidate" && connection) {
        await connection.addIceCandidate(signal.candidate);
      }
    }
  } catch (error) {
    console.error("[WebRTC] Connection error:", error);
    songsStore.setError(error instanceof Error ? error.message : "Connection failed");
    songsStore.setIsConnecting(false);
    disconnectFromHost();
  }
}

/**
 * Disconnect from the game client host
 */
export function disconnectFromHost(): void {
  console.log("[WebRTC] Disconnecting from host");

  // Abort the signal subscription
  if (signalAbortController) {
    signalAbortController.abort();
    signalAbortController = null;
  }

  // Close the WebRTC connection
  if (connection) {
    connection.close();
    connection = null;
  }

  // Reset the store
  songsStore.reset();
}

/**
 * Check if currently connected to the host
 */
export function isConnected(): boolean {
  return songsStore.connectionState() === "connected";
}
