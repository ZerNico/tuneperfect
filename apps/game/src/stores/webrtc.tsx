import { ReactiveMap } from "@solid-primitives/map";
import { createEffect, createSignal, onCleanup } from "solid-js";
import { orpcClient } from "~/lib/orpc";
import { createHostConnection, type HostConnection } from "~/lib/webrtc/host-connection";
import { lobbyStore } from "./lobby";

function createWebRTCStore() {
  // Map of userId -> HostConnection
  const connections = new ReactiveMap<string, HostConnection>();

  // Signal subscription abort controller
  const [abortController, setAbortController] = createSignal<AbortController | null>(null);

  // Whether the signaling subscription is active
  const [isSubscribed, setIsSubscribed] = createSignal(false);

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
        }
      },
      onDataChannelOpen: () => {
        // oRPC channels ready - app can now call songs.list() etc.
      },
    });

    connections.set(userId, connection);

    try {
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
    }
  };

  /**
   * Start listening for signaling messages
   */
  const startSignaling = async () => {
    if (isSubscribed()) {
      return;
    }

    const lobby = lobbyStore.lobby();
    if (!lobby) {
      return;
    }

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
        }
      }
    } catch (error) {
      if (!controller.signal.aborted) {
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
    abortController()?.abort();
    setAbortController(null);
    setIsSubscribed(false);

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
    }
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
