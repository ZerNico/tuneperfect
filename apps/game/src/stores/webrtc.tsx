import { ReactiveMap } from "@solid-primitives/map";
import { createEffect, createSignal, onCleanup } from "solid-js";
import { orpcClient } from "~/lib/orpc";
import { createHostConnection, type HostConnection } from "~/lib/webrtc/host-connection";
import { lobbyStore } from "./lobby";

function createWebRTCStore() {
  // Map of userId -> HostConnection
  const connections = new ReactiveMap<string, HostConnection>();

  // Buffer ICE candidates for users whose connection is still being created
  // This handles the race condition where ICE candidates arrive before handleOffer completes
  const pendingIceCandidates = new Map<string, string[]>();

  // Signal subscription abort controller
  const [abortController, setAbortController] = createSignal<AbortController | null>(null);

  // Whether the signaling subscription is active
  const [isSubscribed, setIsSubscribed] = createSignal(false);

  // Mutex to prevent race condition in startSignaling
  let isStartingSignaling = false;

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
          connections.delete(userId);
          // Clean up any pending ICE candidates for this user
          pendingIceCandidates.delete(userId);
        }
      },
      onDataChannelOpen: () => {
        // oRPC channels ready - app can now call songs.list() etc.
      },
    });

    connections.set(userId, connection);

    try {
      const answerSdp = await connection.createAnswer(offerSdp);

      // Process any buffered ICE candidates that arrived before the connection was ready
      const bufferedCandidates = pendingIceCandidates.get(userId);
      if (bufferedCandidates) {
        for (const candidate of bufferedCandidates) {
          await connection.addIceCandidate(candidate);
        }
        pendingIceCandidates.delete(userId);
      }

      await orpcClient.signaling.sendSignal({
        signal: {
          type: "answer",
          sdp: answerSdp,
          from: lobbyStore.lobby()?.lobby.id || "",
          to: userId,
        },
        to: userId,
      });
    } catch (error) {
      console.error(`[WebRTC] Failed to handle offer from ${userId}:`, error);
      connection.close();
      connections.delete(userId);
      pendingIceCandidates.delete(userId);
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
      // Buffer the candidate - connection might still be creating
      const existing = pendingIceCandidates.get(userId);
      if (existing) {
        existing.push(candidate);
      } else {
        pendingIceCandidates.set(userId, [candidate]);
      }
    }
  };

  /**
   * Start listening for signaling messages
   */
  const startSignaling = async () => {
    // Use both the signal and a mutex to prevent race conditions
    if (isSubscribed() || isStartingSignaling) {
      return;
    }

    const lobby = lobbyStore.lobby();
    if (!lobby) {
      return;
    }

    // Acquire mutex immediately (synchronous)
    isStartingSignaling = true;

    const controller = new AbortController();
    setAbortController(controller);
    setIsSubscribed(true);

    try {
      const iterator = await orpcClient.signaling.subscribeAsHost(undefined, {
        signal: controller.signal,
      });

      for await (const signal of iterator) {
        if (controller.signal.aborted) break;

        if (signal.type === "offer") {
          await handleOffer(signal.from, signal.sdp);
        } else if (signal.type === "ice-candidate") {
          await handleIceCandidate(signal.from, signal.candidate);
        } else if (signal.type === "goodbye") {
          // Guest is gracefully disconnecting - clean up their connection
          console.log(`[WebRTC] Received goodbye from ${signal.from}, reason: ${signal.reason ?? "unknown"}`);
          closeConnection(signal.from);
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("[WebRTC] Signaling subscription error:", error);
      }
    } finally {
      setIsSubscribed(false);
      setAbortController(null);
      isStartingSignaling = false;
    }
  };

  /**
   * Stop listening for signaling messages and close all connections
   */
  const stopSignaling = () => {
    abortController()?.abort();
    setAbortController(null);
    setIsSubscribed(false);
    isStartingSignaling = false;

    for (const [_userId, connection] of connections) {
      connection.close();
    }
    connections.clear();
    pendingIceCandidates.clear();
  };

  /**
   * Close connection for a specific user (e.g., when they leave the lobby)
   */
  const closeConnection = (userId: string) => {
    const connection = connections.get(userId);
    if (connection) {
      connection.close();
      connections.delete(userId);
    }
    pendingIceCandidates.delete(userId);
  };

  /**
   * Get the app client for a specific user (for future bidirectional calls)
   */
  const getAppClient = (userId: string) => {
    const connection = connections.get(userId);
    return connection?.getAppClient() ?? null;
  };

  return {
    connections,
    isSubscribed,
    startSignaling,
    stopSignaling,
    closeConnection,
    getAppClient,
  };
}

export const webrtcStore = createWebRTCStore();

/**
 * Effect to automatically start/stop signaling based on lobby state
 */
export function useWebRTCAutoConnect() {
  createEffect(() => {
    const lobby = lobbyStore.lobby();
    if (lobby) {
      webrtcStore.startSignaling();
    } else {
      webrtcStore.stopSignaling();
    }
  });

  onCleanup(() => {
    webrtcStore.stopSignaling();
  });
}
