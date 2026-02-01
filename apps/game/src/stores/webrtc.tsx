import { ReactiveMap } from "@solid-primitives/map";
import { createEffect, createSignal, onCleanup } from "solid-js";
import { orpcClient } from "~/lib/orpc";
import { createHostConnection, type HostConnection } from "~/lib/webrtc/host-connection";
import { getIceServers } from "~/lib/webrtc/ice-servers";
import { lobbyStore } from "./lobby";

function createWebRTCStore() {
  const connections = new ReactiveMap<string, HostConnection>();
  const pendingIceCandidates = new Map<string, string[]>();
  const [abortController, setAbortController] = createSignal<AbortController | null>(null);
  const [isSubscribed, setIsSubscribed] = createSignal(false);
  let isStartingSignaling = false;

  const handleOffer = async (userId: string, offerSdp: string) => {
    const existingConnection = connections.get(userId);
    if (existingConnection) {
      existingConnection.close();
      connections.delete(userId);
    }

    const iceServers = await getIceServers();

    const connection = createHostConnection(userId, iceServers, {
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

  const handleIceCandidate = async (userId: string, candidate: string) => {
    const connection = connections.get(userId);
    if (connection) {
      await connection.addIceCandidate(candidate);
    } else {
      const existing = pendingIceCandidates.get(userId);
      if (existing) {
        existing.push(candidate);
      } else {
        pendingIceCandidates.set(userId, [candidate]);
      }
    }
  };

  const startSignaling = async () => {
    if (isSubscribed() || isStartingSignaling) {
      return;
    }

    const lobby = lobbyStore.lobby();
    if (!lobby) {
      return;
    }

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

  const closeConnection = (userId: string) => {
    const connection = connections.get(userId);
    if (connection) {
      connection.close();
      connections.delete(userId);
    }
    pendingIceCandidates.delete(userId);
  };

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
