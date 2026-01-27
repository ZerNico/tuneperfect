import { ReactiveMap } from "@solid-primitives/map";
import { createEffect, createSignal, on, onCleanup } from "solid-js";
import { orpcClient } from "~/lib/orpc";
import { createHostConnection, type HostConnection } from "~/lib/webrtc/host-connection";
import type { SongSummary } from "~/lib/webrtc/types";
import { lobbyStore } from "./lobby";
import { songsStore } from "./songs";

function createWebRTCStore() {
  // Map of userId -> HostConnection
  const connections = new ReactiveMap<string, HostConnection>();

  // Signal subscription abort controller
  const [abortController, setAbortController] = createSignal<AbortController | null>(null);

  // Whether the signaling subscription is active
  const [isSubscribed, setIsSubscribed] = createSignal(false);

  /**
   * Get simplified song summaries from the songs store
   */
  const getSongSummaries = (): SongSummary[] => {
    return songsStore.songs().map((song) => ({
      hash: song.hash,
      title: song.title,
      artist: song.artist,
    }));
  };

  /**
   * Send the current song list to all connected users
   */
  const broadcastSongs = () => {
    const songs = getSongSummaries();

    for (const [_userId, connection] of connections) {
      if (connection.isDataChannelOpen()) {
        connection.sendSongs(songs);
      }
    }

    console.log(`[WebRTC] Broadcasted ${songs.length} songs to ${connections.size} connections`);
  };

  /**
   * Send songs to a specific user
   */
  const sendSongsToUser = (userId: string) => {
    const connection = connections.get(userId);
    if (connection && connection.isDataChannelOpen()) {
      connection.sendSongs(getSongSummaries());
    }
  };

  /**
   * Create a connection for a user and handle their offer
   */
  const handleOffer = async (userId: string, offerSdp: string) => {
    // Close existing connection if any
    const existingConnection = connections.get(userId);
    if (existingConnection) {
      existingConnection.close();
      connections.delete(userId);
    }

    const connection = createHostConnection(userId, {
      onIceCandidate: async (candidate) => {
        try {
          await orpcClient.signaling.sendSignal({
            signal: {
              type: "ice-candidate",
              candidate,
              from: lobbyStore.lobby()?.lobby.id || "",
            },
            to: userId,
          });
        } catch (error) {
          console.error(`[WebRTC] Failed to send ICE candidate to ${userId}:`, error);
        }
      },
      onConnectionStateChange: (state) => {
        if (state === "disconnected" || state === "failed" || state === "closed") {
          // Clean up closed connections
          connections.delete(userId);
        }
      },
      onDataChannelOpen: () => {
        // Send songs when data channel is ready
        console.log(`[WebRTC] Data channel open, sending songs to ${userId}`);
        sendSongsToUser(userId);
      },
    });

    connections.set(userId, connection);

    try {
      // Create answer and send it back
      const answerSdp = await connection.createAnswer(offerSdp);

      await orpcClient.signaling.sendSignal({
        signal: {
          type: "answer",
          sdp: answerSdp,
          from: lobbyStore.lobby()?.lobby.id || "",
          to: userId,
        },
        to: userId,
      });

      console.log(`[WebRTC] Sent answer to user ${userId}`);
    } catch (error) {
      console.error(`[WebRTC] Failed to handle offer from ${userId}:`, error);
      connection.close();
      connections.delete(userId);
    }
  };

  /**
   * Handle incoming ICE candidate from a guest
   */
  const handleIceCandidate = async (userId: string, candidate: string) => {
    const connection = connections.get(userId);
    if (connection) {
      await connection.addIceCandidate(candidate);
    } else {
      console.warn(`[WebRTC] Received ICE candidate for unknown user ${userId}`);
    }
  };

  /**
   * Start listening for signaling messages
   */
  const startSignaling = async () => {
    if (isSubscribed()) {
      console.log("[WebRTC] Already subscribed to signaling");
      return;
    }

    const lobby = lobbyStore.lobby();
    if (!lobby) {
      console.log("[WebRTC] No lobby, cannot start signaling");
      return;
    }

    const controller = new AbortController();
    setAbortController(controller);
    setIsSubscribed(true);

    console.log("[WebRTC] Starting signaling subscription for lobby:", lobby.lobby.id);

    try {
      const iterator = await orpcClient.signaling.subscribeAsHost(undefined, {
        signal: controller.signal,
      });

      for await (const signal of iterator) {
        if (controller.signal.aborted) break;

        console.log("[WebRTC] Received signal:", signal.type, "from:", signal.from);

        if (signal.type === "offer") {
          await handleOffer(signal.from, signal.sdp);
        } else if (signal.type === "ice-candidate") {
          await handleIceCandidate(signal.from, signal.candidate);
        }
      }
    } catch (error) {
      if (controller.signal.aborted) {
        console.log("[WebRTC] Signaling subscription aborted");
      } else {
        console.error("[WebRTC] Signaling subscription error:", error);
      }
    } finally {
      setIsSubscribed(false);
      setAbortController(null);
    }
  };

  /**
   * Stop listening for signaling messages and close all connections
   */
  const stopSignaling = () => {
    console.log("[WebRTC] Stopping signaling");

    // Abort the subscription
    abortController()?.abort();
    setAbortController(null);
    setIsSubscribed(false);

    // Close all connections
    for (const [_userId, connection] of connections) {
      connection.close();
    }
    connections.clear();
  };

  /**
   * Close connection for a specific user (e.g., when they leave the lobby)
   */
  const closeConnection = (userId: string) => {
    const connection = connections.get(userId);
    if (connection) {
      connection.close();
      connections.delete(userId);
      console.log(`[WebRTC] Closed connection for user ${userId}`);
    }
  };

  return {
    connections,
    isSubscribed,
    startSignaling,
    stopSignaling,
    broadcastSongs,
    sendSongsToUser,
    closeConnection,
  };
}

export const webrtcStore = createWebRTCStore();

/**
 * Effect to automatically start/stop signaling based on lobby state
 */
export function useWebRTCAutoConnect() {
  createEffect(
    on(
      () => lobbyStore.lobby(),
      (lobby) => {
        if (lobby) {
          webrtcStore.startSignaling();
        } else {
          webrtcStore.stopSignaling();
        }
      },
    ),
  );

  // Also broadcast songs when the song list changes
  createEffect(
    on(
      () => songsStore.songs(),
      () => {
        if (webrtcStore.isSubscribed()) {
          webrtcStore.broadcastSongs();
        }
      },
      { defer: true },
    ),
  );

  onCleanup(() => {
    webrtcStore.stopSignaling();
  });
}
