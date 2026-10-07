import { WEBRTC_CONFIG } from "@tuneperfect/webrtc/utils";
import { createSignal, untrack } from "solid-js";

import { t } from "~/lib/i18n";
import { orpcClient } from "~/lib/orpc";
import { notify } from "~/lib/toast";
import { createGuestConnection, type GuestConnection } from "~/lib/webrtc/guest-connection";
import { getIceServers } from "~/lib/webrtc/ice-servers";

/**
 * - `connecting`: the first attempt is under way.
 * - `reconnecting`: the connection dropped or an attempt failed; another is under way or scheduled.
 * - `failed`: given up after `WEBRTC_CONFIG.reconnect.maxAttempts`; `retryConnection` starts over.
 */
export type ConnectionStatus = "idle" | "connecting" | "connected" | "reconnecting" | "failed";

type OutgoingSignal = Parameters<typeof orpcClient.signaling.sendSignal>[0]["signal"];

/** Everything that belongs to one connection attempt. A new attempt or a stop aborts it. */
interface Attempt {
  /** Sent with every signal and echoed by the game, so an older attempt's late answer can't be mixed in. */
  session: string;
  userId: string;
  abort: AbortController;
  connection: GuestConnection | null;
  /** The game echoed our session, so it knows how to restart ICE on this connection (older games don't). */
  hostCanRestartIce: boolean;
  /** A signaling stream is feeding this attempt. It can end while connected (an API restart). */
  listening: boolean;
  /** Running out means the attempt failed: no answer to an offer, or an ICE restart that didn't help. */
  timeout?: ReturnType<typeof setTimeout>;
  disconnectedTimer?: ReturnType<typeof setTimeout>;
}

function createConnectionStore() {
  const [connection, setConnection] = createSignal<GuestConnection | null>(null);
  const [status, setStatus] = createSignal<ConnectionStatus>("idle");
  const [channelsReady, setChannelsReady] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = createSignal(0);
  const [currentUserId, setCurrentUserId] = createSignal<string | null>(null);
  const [visible, setVisible] = createSignal(document.visibilityState === "visible");

  let attempt: Attempt | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  const send = (signal: OutgoingSignal) => orpcClient.signaling.sendSignal({ signal });

  const endAttempt = () => {
    if (!attempt) return;
    clearTimeout(attempt.timeout);
    clearTimeout(attempt.disconnectedTimer);
    attempt.abort.abort();
    attempt.connection?.close();
    attempt = null;
    setConnection(null);
    setChannelsReady(false);
  };

  const startTimeout = (current: Attempt, reason: string) => {
    clearTimeout(current.timeout);
    current.timeout = setTimeout(() => fail(current, reason), WEBRTC_CONFIG.connectionTimeout);
  };

  const markConnectedIfReady = (current: Attempt) => {
    if (attempt !== current || current.connection?.pc.connectionState !== "connected" || !channelsReady()) return;
    clearTimeout(current.timeout);
    clearTimeout(current.disconnectedTimer);
    setError(null);
    setReconnectAttempts(0);
    setStatus("connected");
  };

  /** The attempt is over: try again after a growing delay, or give up after too many in a row. */
  const fail = (current: Attempt, reason: string) => {
    if (attempt !== current) return;
    console.warn(`[WebRTC] Connection attempt failed: ${reason}`);
    endAttempt();
    // The next attempt fetches TURN credentials again: these may be why it failed (a rotated secret).
    getIceServers.invalidate();
    setError(reason);

    const userId = currentUserId();
    const attempts = reconnectAttempts();
    if (!userId || attempts >= WEBRTC_CONFIG.reconnect.maxAttempts) {
      setStatus("failed");
      return;
    }

    setStatus("reconnecting");
    // In the background the phone often can't connect at all (it's suspended or throttled), so trying
    // there would only use up the attempts and warn about it: `resume` starts over once it's back.
    if (!visible()) return;

    if (attempts === WEBRTC_CONFIG.reconnect.maxAttemptsBeforeToast) {
      notify({ message: t("songs.connectionTrouble"), intent: "warning" });
    }
    const delay = Math.min(WEBRTC_CONFIG.reconnect.initialDelay * 2 ** attempts, WEBRTC_CONFIG.reconnect.maxDelay);
    clearTimeout(reconnectTimer);
    reconnectTimer = setTimeout(() => {
      setReconnectAttempts((n) => n + 1);
      void connect(userId);
    }, delay);
  };

  type SignalStream = Awaited<ReturnType<typeof orpcClient.signaling.subscribeAsGuest>>;

  /** Feeds the game's answers and candidates into the attempt's connection until the stream ends. */
  const listen = async (current: Attempt, stream: SignalStream) => {
    current.listening = true;
    try {
      for await (const signal of stream) {
        if (attempt !== current || !current.connection) break;
        // An older attempt's late answer or candidates don't belong to this connection.
        if (signal.session !== undefined && signal.session !== current.session) continue;

        if (signal.type === "answer") {
          if (signal.session === current.session) current.hostCanRestartIce = true;
          await current.connection.setAnswer(signal.sdp);
        } else if (signal.type === "ice-candidate") {
          await current.connection.addIceCandidate(signal.candidate);
        } else if (signal.type === "goodbye") {
          console.log(`[WebRTC] Received goodbye: ${signal.reason ?? "unknown"}`);
          endAttempt();
          setStatus("failed");
          return;
        }
      }
    } finally {
      current.listening = false;
    }
  };

  /** Finds a new network path for the current connection (e.g. after switching from Wi-Fi to mobile data). */
  const restartIce = async (current: Attempt) => {
    if (attempt !== current || !current.connection) return;
    // Older games answer a second offer with a brand-new connection, which this one can't use.
    if (!current.hostCanRestartIce) {
      fail(current, "Connection lost");
      return;
    }
    try {
      startTimeout(current, "ICE restart timed out");
      // The stream that brought the first answer may be gone by now: without one the restart's answer is lost
      if (!current.listening) {
        const stream = await orpcClient.signaling.subscribeAsGuest(undefined, { signal: current.abort.signal });
        if (attempt !== current) return;
        // oxlint-disable-next-line solid/reactivity -- a store callback, not a component
        listen(current, stream).catch((err: unknown) => {
          if (attempt === current) fail(current, err instanceof Error ? err.message : "Signaling failed");
        });
      }
      // The connection's TURN credentials may have expired since it was set up.
      const iceServers = await getIceServers();
      if (attempt !== current || !current.connection) return;
      current.connection.setIceServers(iceServers);
      const sdp = await current.connection.createOffer({ iceRestart: true });
      await send({ type: "offer", sdp, from: current.userId, session: current.session });
    } catch (err) {
      fail(current, err instanceof Error ? err.message : "ICE restart failed");
    }
  };

  async function connect(userId: string) {
    clearTimeout(reconnectTimer);
    endAttempt();

    const current: Attempt = {
      session: crypto.randomUUID(),
      userId,
      abort: new AbortController(),
      connection: null,
      hostCanRestartIce: false,
      listening: false,
    };
    attempt = current;
    setStatus(reconnectAttempts() > 0 ? "reconnecting" : "connecting");
    // An offer nobody answers (the game is restarting, or between signaling streams) must not hang forever.
    startTimeout(current, "Connection timed out");

    try {
      const iceServers = await getIceServers();
      if (attempt !== current) return;

      const conn = createGuestConnection(iceServers, {
        onIceCandidate: (candidate) => {
          send({ type: "ice-candidate", candidate, from: userId, session: current.session }).catch((err: unknown) =>
            console.error("[WebRTC] Failed to send ICE candidate:", err),
          );
        },
        onConnectionStateChange: (state) => {
          if (attempt !== current) return;
          if (state === "connected") {
            markConnectedIfReady(current);
          } else if (state === "disconnected") {
            // Often recovers by itself; if not, look for a new path before giving the connection up.
            // Older games can't restart ICE, so there it gets as long as a new connection would.
            setStatus("reconnecting");
            clearTimeout(current.disconnectedTimer);
            current.disconnectedTimer = setTimeout(
              () => void restartIce(current),
              current.hostCanRestartIce ? WEBRTC_CONFIG.reconnect.disconnectedGrace : WEBRTC_CONFIG.connectionTimeout,
            );
          } else if (state === "failed" || state === "closed") {
            fail(current, `Connection ${state}`);
          }
        },
        onChannelOpen: () => {
          if (attempt !== current) return;
          setChannelsReady(true);
          markConnectedIfReady(current);
        },
        onChannelClose: () => {
          if (attempt !== current) return;
          setChannelsReady(false);
          fail(current, "Data channel closed");
        },
      });
      current.connection = conn;
      setConnection(conn);

      // Subscribed before offering, so the answer can't come before we listen.
      const iterator = await orpcClient.signaling.subscribeAsGuest(undefined, { signal: current.abort.signal });
      if (attempt !== current) return;

      const offerSdp = await conn.createOffer();
      await send({ type: "offer", sdp: offerSdp, from: userId, session: current.session });

      await listen(current, iterator);

      // The signaling stream ended (an API restart or a proxy timeout). A working connection
      // doesn't need it (an ICE restart subscribes again); one that isn't up yet won't get its answer.
      if (attempt === current && status() !== "connected") fail(current, "Signaling ended");
    } catch (err) {
      if (attempt !== current) return;
      console.error("[WebRTC] Connection error:", err);
      fail(current, err instanceof Error ? err.message : "Connection failed");
    }
  }

  // The lifecycle functions read the store's signals; called from an effect (the auth layout does),
  // that effect must not start depending on the connection's status, or giving up would restart it.

  /** Connects to the lobby's game as `userId`; does nothing if that's already under way or done. */
  function startConnection(userId: string) {
    untrack(() => {
      if (currentUserId() === userId && status() !== "idle" && status() !== "failed") return;
      setCurrentUserId(userId);
      setReconnectAttempts(0);
      void connect(userId);
    });
  }

  /** Starts over after the phone gave up (or right away while waiting for the next attempt). */
  function retryConnection() {
    untrack(() => {
      const userId = currentUserId();
      if (!userId) return;
      setReconnectAttempts(0);
      void connect(userId);
    });
  }

  /** Disconnects right away; the game is told so (best effort) to free the connection at once. */
  function stopConnection() {
    untrack(() => {
      const current = attempt;
      if (current && status() === "connected") {
        orpcClient.signaling
          .sendSignal(
            { signal: { type: "goodbye", from: current.userId, reason: "user_left", session: current.session } },
            { signal: AbortSignal.timeout(5_000) },
          )
          .catch(() => {});
      }
      clearTimeout(reconnectTimer);
      setCurrentUserId(null);
      setReconnectAttempts(0);
      endAttempt();
      setError(null);
      setStatus("idle");
    });
  }

  /** The game stopped answering calls (see the heartbeat) although the connection looks up. */
  function reportConnectionLost() {
    untrack(() => {
      if (attempt && status() === "connected") fail(attempt, "Heartbeat timed out");
    });
  }

  // Coming back to the phone (screen unlocked, app switched back) or back online: don't wait out the
  // backoff, and start over if the phone had given up.
  const resume = () => {
    setVisible(document.visibilityState === "visible");
    if (!visible() || !currentUserId()) return;
    // Waiting for the next attempt, or given up.
    if ((status() === "reconnecting" && !attempt) || status() === "failed") retryConnection();
  };
  document.addEventListener("visibilitychange", resume);
  window.addEventListener("online", resume);

  return {
    connection,
    status,
    channelsReady,
    error,
    reconnectAttempts,
    /** Whether the page is in the foreground; the phone doesn't retry or check the connection in the background. */
    visible,
    startConnection,
    stopConnection,
    retryConnection,
    reportConnectionLost,
  };
}

export const connectionStore = createConnectionStore();
export const { startConnection, stopConnection, retryConnection } = connectionStore;
