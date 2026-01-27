import { createEffect, createRoot, createSignal } from "solid-js";
import { orpcClient } from "~/lib/orpc";
import { notify } from "~/lib/toast";
import { createGuestConnection, type GameClient, type GuestConnection } from "~/lib/webrtc/guest-connection";

// Connection timeout in milliseconds
const CONNECTION_TIMEOUT_MS = 30_000;
// Number of failed attempts before showing error toast
const MAX_ATTEMPTS_BEFORE_TOAST = 3;

// Singleton connection state
let connection: GuestConnection | null = null;
let signalAbortController: AbortController | null = null;
let connectionTimeoutId: ReturnType<typeof setTimeout> | null = null;

// Mutex to prevent duplicate connection attempts
let isConnectionInProgress = false;

// Reactive signal for currentUserId (was previously a plain variable)
const [currentUserId, setCurrentUserId] = createSignal<string | null>(null);

// Reactive signals for connection state
const [connectionState, setConnectionState] = createSignal<RTCPeerConnectionState>("new");
const [isConnecting, setIsConnecting] = createSignal(false);
const [error, setError] = createSignal<string | null>(null);
const [gameClient, setGameClient] = createSignal<GameClient | null>(null);

// Reconnection state
const [shouldBeConnected, setShouldBeConnected] = createSignal(false);
const [reconnectAttempts, setReconnectAttempts] = createSignal(0);
let reconnectTimeoutId: ReturnType<typeof setTimeout> | null = null;

/**
 * Clean up timeout if it exists
 */
function clearConnectionTimeout(): void {
  if (connectionTimeoutId) {
    clearTimeout(connectionTimeoutId);
    connectionTimeoutId = null;
  }
}

/**
 * Connect to the game client host via WebRTC
 * @param userId The current user's ID (needed for signaling)
 * @returns The oRPC game client when connected
 */
export async function connectToHost(userId: string): Promise<GameClient | null> {
  // Mutex check - prevent duplicate connection attempts
  if (isConnectionInProgress) {
    return gameClient();
  }

  // Don't reconnect if already connected
  if (connectionState() === "connected") {
    return gameClient();
  }

  // Acquire mutex
  isConnectionInProgress = true;
  setIsConnecting(true);
  setError(null);

  try {
    // Set connection timeout
    connectionTimeoutId = setTimeout(() => {
      console.warn("[WebRTC] Connection timeout after", CONNECTION_TIMEOUT_MS, "ms");
      // Clean up and set to failed state
      cleanupConnection();
      setError("Connection timeout");
      setConnectionState("failed");
      setIsConnecting(false);
      isConnectionInProgress = false;
    }, CONNECTION_TIMEOUT_MS);

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
        setConnectionState(state);

        if (state === "connected") {
          clearConnectionTimeout();
          setIsConnecting(false);
          isConnectionInProgress = false;
        } else if (state === "disconnected" || state === "failed" || state === "closed") {
          clearConnectionTimeout();
          setIsConnecting(false);
          isConnectionInProgress = false;
          setGameClient(() => null);
          if (state === "failed") {
            setError("Connection failed");
          }
        }
      },
      onDataChannelOpen: () => {
        // Get the game client when data channels are ready
        const client = connection?.getGameClient() ?? null;
        // Use a function to set the value to prevent SolidJS from calling it
        // (SolidJS treats function values specially in signals)
        setGameClient(() => client);
      },
    });

    // Start listening for signals from the host
    signalAbortController = new AbortController();

    // Create and send offer
    const offerSdp = await connection.createOffer();

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

    // Process incoming signals
    for await (const signal of iterator) {
      if (signalAbortController.signal.aborted) break;

      if (signal.type === "answer" && connection) {
        await connection.setAnswer(signal.sdp);
      } else if (signal.type === "ice-candidate" && connection) {
        await connection.addIceCandidate(signal.candidate);
      }
    }

    return gameClient();
  } catch (error) {
    console.error("[WebRTC] Connection error:", error);
    setError(error instanceof Error ? error.message : "Connection failed");
    setIsConnecting(false);

    // Clean up connection resources but set state to "failed" to trigger reconnect
    cleanupConnection();
    setGameClient(() => null);
    setConnectionState("failed");

    return null;
  } finally {
    // Always release mutex
    isConnectionInProgress = false;
  }
}

/**
 * Clean up connection resources without resetting state signals
 */
function cleanupConnection(): void {
  clearConnectionTimeout();

  if (signalAbortController) {
    signalAbortController.abort();
    signalAbortController = null;
  }

  if (connection) {
    connection.close();
    connection = null;
  }
}

/**
 * Disconnect from the game client host
 */
function disconnectFromHost(): void {
  cleanupConnection();

  // Reset state
  setConnectionState("new");
  setIsConnecting(false);
  setError(null);
  setGameClient(() => null);
  isConnectionInProgress = false;
}

/**
 * Start a persistent connection to the game host.
 * The connection will auto-reconnect on failure until stopConnection() is called.
 * @param userId The current user's ID (needed for signaling)
 */
export function startConnection(userId: string): void {
  setCurrentUserId(userId);
  setShouldBeConnected(true);
  setReconnectAttempts(0);
  setError(null);
  connectToHost(userId);
}

/**
 * Stop the connection and disable auto-reconnect.
 */
export function stopConnection(): void {
  // Cancel any pending reconnect
  if (reconnectTimeoutId) {
    clearTimeout(reconnectTimeoutId);
    reconnectTimeoutId = null;
  }

  setCurrentUserId(null);
  setShouldBeConnected(false);
  setReconnectAttempts(0);
  disconnectFromHost();
}

/**
 * Check if currently connected to the host
 */
export function isConnected(): boolean {
  return connectionState() === "connected";
}

/**
 * Exported reactive signals for UI components
 */
export const webrtcStore = {
  connectionState,
  isConnecting,
  error,
  gameClient,
  reconnectAttempts,
};

// Auto-reconnect effect (runs at module level)
createRoot(() => {
  createEffect(() => {
    const state = connectionState();
    const shouldConnect = shouldBeConnected();
    const userId = currentUserId();

    // Reset attempts on successful connection
    if (state === "connected") {
      setReconnectAttempts(0);
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
        reconnectTimeoutId = null;
      }
      return;
    }

    // Reconnect on failure if we should be connected
    if (
      shouldConnect &&
      userId &&
      !isConnecting() &&
      !isConnectionInProgress &&
      !reconnectTimeoutId && // Prevent scheduling multiple reconnects
      (state === "failed" || state === "disconnected" || state === "closed")
    ) {
      const attempts = reconnectAttempts();

      // Show error toast after MAX_ATTEMPTS_BEFORE_TOAST failed attempts
      if (attempts === MAX_ATTEMPTS_BEFORE_TOAST) {
        notify({
          message: "Having trouble connecting to the game. Will keep trying...",
          intent: "warning",
        });
      }

      // Exponential backoff: 2s, 4s, 8s, 16s, 32s, 64s (cap)
      // Start at 2s to avoid immediate retry spam
      const delay = Math.min(2000 * 2 ** attempts, 64000);

      reconnectTimeoutId = setTimeout(() => {
        reconnectTimeoutId = null;
        // Double-check we still want to be connected (use signal getter)
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
