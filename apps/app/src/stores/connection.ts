import { WEBRTC_CONFIG } from "@tuneperfect/webrtc/utils";
import { createEffect, createRoot, createSignal, onCleanup, untrack } from "solid-js";
import { t } from "~/lib/i18n";
import { orpcClient } from "~/lib/orpc";
import { notify } from "~/lib/toast";
import { createGuestConnection, type GuestConnection } from "~/lib/webrtc/guest-connection";

function createConnectionStore() {
  const [connection, setConnection] = createSignal<GuestConnection | null>(null);
  const [connectionState, setConnectionState] = createSignal<RTCPeerConnectionState>("new");
  const [channelsReady, setChannelsReady] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = createSignal(0);
  const [currentUserId, setCurrentUserId] = createSignal<string | null>(null);

  let signalAbortController: AbortController | null = null;
  let isConnecting = false;

  async function connect(userId: string) {
    if (isConnecting) return;
    if (connectionState() === "connected" && channelsReady()) return;

    isConnecting = true;

    if (signalAbortController) {
      signalAbortController.abort();
    }
    connection()?.close();

    setError(null);
    setChannelsReady(false);
    setConnectionState("connecting");

    try {
      const conn = createGuestConnection({
        onIceCandidate: async (candidate) => {
          try {
            await orpcClient.signaling.sendSignal({
              signal: { type: "ice-candidate", candidate, from: userId },
            });
          } catch (err) {
            console.error("[WebRTC] Failed to send ICE candidate:", err);
          }
        },
        onConnectionStateChange: setConnectionState,
        onChannelsReady: () => setChannelsReady(true),
        onChannelsClosed: () => setChannelsReady(false),
      });

      setConnection(conn);

      signalAbortController = new AbortController();
      const iterator = await orpcClient.signaling.subscribeAsGuest(undefined, {
        signal: signalAbortController.signal,
      });

      const offerSdp = await conn.createOffer();
      await orpcClient.signaling.sendSignal({
        signal: { type: "offer", sdp: offerSdp, from: userId },
      });

      for await (const signal of iterator) {
        if (signalAbortController.signal.aborted) break;

        if (signal.type === "answer") {
          await conn.setAnswer(signal.sdp);
        } else if (signal.type === "ice-candidate") {
          await conn.addIceCandidate(signal.candidate);
        } else if (signal.type === "goodbye") {
          console.log(`[WebRTC] Received goodbye: ${signal.reason ?? "unknown"}`);
          disconnect();
          break;
        }
      }
    } catch (err) {
      console.error("[WebRTC] Connection error:", err);
      setError(err instanceof Error ? err.message : "Connection failed");
      setConnectionState("failed");
    } finally {
      isConnecting = false;
    }
  }

  function disconnect() {
    signalAbortController?.abort();
    signalAbortController = null;
    connection()?.close();
    setConnection(null);
    setConnectionState("new");
    setChannelsReady(false);
    setError(null);
    isConnecting = false;
  }

  async function startConnection(userId: string) {
    setCurrentUserId(userId);
    setReconnectAttempts(0);
    await connect(userId);
  }

  async function stopConnection() {
    const userId = currentUserId();
    if (userId && connectionState() === "connected") {
      try {
        await orpcClient.signaling.sendSignal({
          signal: { type: "goodbye", from: userId, reason: "user_left" },
        });
      } catch {}
    }
    setCurrentUserId(null);
    setReconnectAttempts(0);
    disconnect();
  }

  createRoot(() => {
    createEffect(() => {
      const state = connectionState();
      const userId = currentUserId();

      if (state === "connected") {
        setReconnectAttempts(0);
        return;
      }

      if (!userId || state === "connecting" || state === "new" || isConnecting) {
        return;
      }

      if (state === "failed" || state === "disconnected" || state === "closed") {
        const attempts = reconnectAttempts();

        if (attempts === WEBRTC_CONFIG.reconnect.maxAttemptsBeforeToast) {
          notify({ message: t("songs.connectionTrouble"), intent: "warning" });
        }

        const delay = Math.min(WEBRTC_CONFIG.reconnect.initialDelay * 2 ** attempts, WEBRTC_CONFIG.reconnect.maxDelay);

        console.log(`[WebRTC] Reconnecting in ${delay}ms (attempt ${attempts + 1})`);

        const timeoutId = setTimeout(() => {
          untrack(() => {
            if (currentUserId() && !isConnecting) {
              setReconnectAttempts((n) => n + 1);
              connect(userId);
            }
          });
        }, delay);

        onCleanup(() => clearTimeout(timeoutId));
      }
    });
  });

  return {
    connection,
    connectionState,
    channelsReady,
    error,
    reconnectAttempts,
    startConnection,
    stopConnection,
  };
}

export const connectionStore = createConnectionStore();
export const { startConnection, stopConnection } = connectionStore;
