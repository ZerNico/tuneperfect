import { createHeartbeat, WEBRTC_CONFIG } from "@tuneperfect/webrtc/utils";
import { createEffect, createRoot, createSignal } from "solid-js";
import { t } from "~/lib/i18n";
import { orpcClient } from "~/lib/orpc";
import { notify } from "~/lib/toast";
import { createGuestConnection, type GameClient, type GuestConnection } from "~/lib/webrtc/guest-connection";

function createWebRTCStore() {
  let connection: GuestConnection | null = null;
  let signalAbortController: AbortController | null = null;
  let connectionTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let isConnectionInProgress = false;
  let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;
  let heartbeat: ReturnType<typeof createHeartbeat> | null = null;

  const [currentUserId, setCurrentUserId] = createSignal<string | null>(null);
  const [connectionState, setConnectionState] = createSignal<RTCPeerConnectionState>("new");
  const [isConnecting, setIsConnecting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [gameClient, setGameClient] = createSignal<GameClient | null>(null);
  const [shouldBeConnected, setShouldBeConnected] = createSignal(false);
  const [reconnectAttempts, setReconnectAttempts] = createSignal(0);

  function clearConnectionTimeout(): void {
    if (connectionTimeoutId) {
      clearTimeout(connectionTimeoutId);
      connectionTimeoutId = null;
    }
  }

  function clearReconnectTimeout(): void {
    if (reconnectTimeoutId) {
      clearTimeout(reconnectTimeoutId);
      reconnectTimeoutId = null;
    }
  }

  function stopHeartbeat(): void {
    heartbeat?.stop();
    heartbeat = null;
  }

  function startHeartbeat(): void {
    const client = gameClient();
    if (!client) return;

    heartbeat = createHeartbeat(
      async () => {
        await client.ping();
      },
      {
        interval: WEBRTC_CONFIG.heartbeat.interval,
        timeout: WEBRTC_CONFIG.heartbeat.timeout,
        onFailure: () => {
          console.warn("[WebRTC] Heartbeat failed, triggering reconnect");
          setConnectionState("disconnected");
          setGameClient(() => null);
          stopHeartbeat();
        },
      },
    );

    heartbeat.start();
  }

  function cleanupConnection(): void {
    clearConnectionTimeout();
    stopHeartbeat();

    if (signalAbortController) {
      signalAbortController.abort();
      signalAbortController = null;
    }

    if (connection) {
      connection.close();
      connection = null;
    }
  }

  async function sendGoodbye(userId: string, reason: "user_left" | "error" = "user_left"): Promise<void> {
    try {
      await orpcClient.signaling.sendSignal({
        signal: { type: "goodbye", from: userId, reason },
      });
    } catch {
      // Ignore errors when sending goodbye
    }
  }

  async function connectToHost(userId: string): Promise<GameClient | null> {
    if (isConnectionInProgress) return gameClient();
    if (connectionState() === "connected") return gameClient();

    isConnectionInProgress = true;
    setIsConnecting(true);
    setError(null);

    try {
      connectionTimeoutId = setTimeout(() => {
        console.warn("[WebRTC] Connection timeout");
        cleanupConnection();
        setError("Connection timeout");
        setConnectionState("failed");
        setIsConnecting(false);
        isConnectionInProgress = false;
      }, WEBRTC_CONFIG.connectionTimeout);

      connection = createGuestConnection({
        onIceCandidate: async (candidate) => {
          try {
            await orpcClient.signaling.sendSignal({
              signal: { type: "ice-candidate", candidate, from: userId },
            });
          } catch (err) {
            console.error("[WebRTC] Failed to send ICE candidate:", err);
          }
        },
        onConnectionStateChange: (state) => {
          setConnectionState(state);

          if (state === "connected") {
            clearConnectionTimeout();
            setIsConnecting(false);
            isConnectionInProgress = false;
            startHeartbeat();
          } else if (state === "disconnected" || state === "failed" || state === "closed") {
            clearConnectionTimeout();
            setIsConnecting(false);
            isConnectionInProgress = false;
            setGameClient(() => null);
            stopHeartbeat();
            if (state === "failed") {
              setError("Connection failed");
            }
          }
        },
        onDataChannelOpen: () => {
          const client = connection?.getGameClient() ?? null;
          setGameClient(() => client);
        },
      });

      signalAbortController = new AbortController();

      // Subscribe BEFORE sending offer to avoid race condition
      const iterator = await orpcClient.signaling.subscribeAsGuest(undefined, {
        signal: signalAbortController.signal,
      });

      const offerSdp = await connection.createOffer();

      await orpcClient.signaling.sendSignal({
        signal: { type: "offer", sdp: offerSdp, from: userId },
      });

      for await (const signal of iterator) {
        if (signalAbortController.signal.aborted) break;

        if (signal.type === "answer" && connection) {
          await connection.setAnswer(signal.sdp);
        } else if (signal.type === "ice-candidate" && connection) {
          await connection.addIceCandidate(signal.candidate);
        } else if (signal.type === "goodbye") {
          console.log(`[WebRTC] Received goodbye from host, reason: ${signal.reason ?? "unknown"}`);
          cleanupConnection();
          setConnectionState("closed");
          setGameClient(() => null);
          break;
        }
      }

      return gameClient();
    } catch (err) {
      console.error("[WebRTC] Connection error:", err);
      setError(err instanceof Error ? err.message : "Connection failed");
      setIsConnecting(false);
      cleanupConnection();
      setGameClient(() => null);
      setConnectionState("failed");
      return null;
    } finally {
      isConnectionInProgress = false;
    }
  }

  function disconnectFromHost(): void {
    cleanupConnection();
    setConnectionState("new");
    setIsConnecting(false);
    setError(null);
    setGameClient(() => null);
    isConnectionInProgress = false;
  }

  function startConnection(userId: string): void {
    setCurrentUserId(userId);
    setShouldBeConnected(true);
    setReconnectAttempts(0);
    setError(null);
    connectToHost(userId);
  }

  async function stopConnection(): Promise<void> {
    const userId = currentUserId();

    clearReconnectTimeout();

    if (userId && (connectionState() === "connected" || connectionState() === "connecting")) {
      await sendGoodbye(userId, "user_left");
    }

    setCurrentUserId(null);
    setShouldBeConnected(false);
    setReconnectAttempts(0);
    disconnectFromHost();
  }

  function isConnected(): boolean {
    return connectionState() === "connected";
  }

  function waitForConnection(): Promise<GameClient> {
    return new Promise((resolve, reject) => {
      const client = gameClient();
      if (client && connectionState() === "connected") {
        resolve(client);
        return;
      }

      if (connectionState() === "failed" && !isConnecting() && !shouldBeConnected()) {
        reject(new Error(error() ?? "Connection failed"));
        return;
      }

      const totalTimeout = WEBRTC_CONFIG.connectionTimeout + WEBRTC_CONFIG.reconnect.waitForConnectionBuffer;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      let cleanup: (() => void) | null = null;

      const finish = (result: { type: "success"; client: GameClient } | { type: "error"; error: Error }) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        cleanup?.();

        if (result.type === "success") {
          resolve(result.client);
        } else {
          reject(result.error);
        }
      };

      timeoutId = setTimeout(() => {
        finish({ type: "error", error: new Error("Connection timeout") });
      }, totalTimeout);

      cleanup = createRoot((dispose) => {
        createEffect(() => {
          const state = connectionState();
          const client = gameClient();
          const connecting = isConnecting();
          const err = error();

          if (state === "connected" && client) {
            finish({ type: "success", client });
          } else if (state === "failed" && !connecting) {
            finish({ type: "error", error: new Error(err ?? "Connection failed") });
          }
        });

        return dispose;
      });
    });
  }

  // Auto-reconnect effect
  createRoot(() => {
    createEffect(() => {
      const state = connectionState();
      const shouldConnect = shouldBeConnected();
      const userId = currentUserId();

      if (state === "connected") {
        setReconnectAttempts(0);
        clearReconnectTimeout();
        return;
      }

      if (
        shouldConnect &&
        userId &&
        !isConnecting() &&
        !isConnectionInProgress &&
        !reconnectTimeoutId &&
        (state === "failed" || state === "disconnected" || state === "closed")
      ) {
        const attempts = reconnectAttempts();

        if (attempts === WEBRTC_CONFIG.reconnect.maxAttemptsBeforeToast) {
          notify({
            message: t("songs.connectionTrouble"),
            intent: "warning",
          });
        }

        const delay = Math.min(WEBRTC_CONFIG.reconnect.initialDelay * 2 ** attempts, WEBRTC_CONFIG.reconnect.maxDelay);

        reconnectTimeoutId = setTimeout(() => {
          reconnectTimeoutId = null;
          const currentShouldConnect = shouldBeConnected();
          const currentUserIdValue = currentUserId();
          if (currentShouldConnect && currentUserIdValue) {
            setReconnectAttempts((n) => n + 1);
            connectToHost(currentUserIdValue);
          }
        }, delay);
      }
    });
  });

  return {
    connectionState,
    isConnecting,
    error,
    gameClient,
    reconnectAttempts,
    startConnection,
    stopConnection,
    isConnected,
    waitForConnection,
  };
}

export const webrtcStore = createWebRTCStore();

export const { startConnection, stopConnection, isConnected, waitForConnection } = webrtcStore;
