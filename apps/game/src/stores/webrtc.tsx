import { ReactiveMap } from "@solid-primitives/map";
import { createEffect, createMemo, on, onCleanup, untrack } from "solid-js";

import { orpcClient } from "~/lib/orpc";
import { createHostConnection, type HostConnection } from "~/lib/webrtc/host-connection";
import { getIceServers } from "~/lib/webrtc/ice-servers";

import { lobbyStore } from "./lobby";

/** A `disconnected` connection often recovers by itself (a phone switching networks or waking up). */
const DISCONNECT_GRACE_MS = 30_000;
const RECONNECT_MAX_MS = 30_000;
/** Once the signaling stream has delivered a signal or stayed open this long, its backoff starts over. */
const HEALTHY_SUBSCRIPTION_MS = 30_000;
/** A hung API call must not hold up a phone's signals forever. */
const SIGNAL_TIMEOUT_MS = 10_000;
/** Candidates kept per phone while waiting for its offer. */
const MAX_PENDING_CANDIDATES = 64;

type OutgoingSignal = Parameters<typeof orpcClient.signaling.sendSignal>[0]["signal"];

interface PendingCandidate {
  candidate: string;
  session: string | undefined;
}

/**
 * One run of `startSignaling`. Signals are handled asynchronously, so a stop (or a new lobby) can
 * come in between: work of an ended generation checks `signal` and leaves everything alone.
 */
interface Generation {
  signal: AbortSignal;
  lobbyId: string;
}

/** Resolves after `ms`, or right away once `signal` aborts. */
const abortableSleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal.addEventListener("abort", done, { once: true });
  });

function createWebRTCStore() {
  const connections = new ReactiveMap<string, HostConnection>();
  // A phone sends its offer and candidates as separate requests, so a candidate can arrive first.
  const pendingIceCandidates = new Map<string, PendingCandidate[]>();
  // Each phone's signals are handled in order, but a slow one (or a slow API call) doesn't hold up the others.
  const signalQueues = new Map<string, Promise<void>>();
  let abortController: AbortController | null = null;

  const enqueue = (generation: Generation, userId: string, task: () => Promise<void>) => {
    const next = (signalQueues.get(userId) ?? Promise.resolve())
      .then(() => (generation.signal.aborted ? undefined : task()))
      .catch((error: unknown) => console.error(`[WebRTC] Failed to handle a signal from ${userId}:`, error));
    signalQueues.set(userId, next);
    void next.finally(() => {
      if (signalQueues.get(userId) === next) signalQueues.delete(userId);
    });
  };

  const sendToPhone = (userId: string, signal: OutgoingSignal) =>
    orpcClient.signaling.sendSignal({ signal, to: userId }, { signal: AbortSignal.timeout(SIGNAL_TIMEOUT_MS) });

  const handleOffer = async (generation: Generation, userId: string, offerSdp: string, session: string | undefined) => {
    const from = generation.lobbyId;
    const existing = connections.get(userId);

    // The same attempt offering again restarts ICE on its connection, keeping the data channel.
    if (existing && session !== undefined && existing.session === session) {
      // The answering side gathers again too; its TURN credentials may have expired by now.
      const iceServers = await getIceServers();
      if (generation.signal.aborted || connections.get(userId) !== existing) return;
      existing.setIceServers(iceServers);
      const answerSdp = await existing.createAnswer(offerSdp);
      if (generation.signal.aborted) return;
      await sendToPhone(userId, { type: "answer", sdp: answerSdp, from, to: userId, session });
      return;
    }

    if (existing) {
      existing.close();
      connections.delete(userId);
    }

    const iceServers = await getIceServers();
    // Signaling stopped while the servers loaded: don't open a connection nobody will close.
    if (generation.signal.aborted) return;

    let disconnectTimer: ReturnType<typeof setTimeout> | undefined;
    const dispose = () => {
      clearTimeout(disconnectTimer);
      // A newer connection from the same user may have replaced this one already.
      if (connections.get(userId) === connection) {
        connections.delete(userId);
      }
      // Closes the data channel and the peer connection, so nothing keeps them alive.
      connection.close();
    };

    const connection = createHostConnection(userId, session, iceServers, {
      onIceCandidate: (candidate) => {
        sendToPhone(userId, { type: "ice-candidate", candidate, from, session }).catch((error: unknown) =>
          console.error(`[WebRTC] Failed to send ICE candidate to ${userId}:`, error),
        );
      },
      onConnectionStateChange: (state) => {
        if (state === "failed" || state === "closed") {
          // The next phone's offer fetches TURN credentials again: these may be why it failed.
          if (state === "failed") getIceServers.invalidate();
          dispose();
        } else if (state === "disconnected") {
          clearTimeout(disconnectTimer);
          disconnectTimer = setTimeout(dispose, DISCONNECT_GRACE_MS);
        } else if (state === "connected") {
          clearTimeout(disconnectTimer);
        }
      },
    });

    connections.set(userId, connection);

    try {
      const answerSdp = await connection.createAnswer(offerSdp);
      if (generation.signal.aborted) {
        dispose();
        return;
      }

      // Candidates of this attempt that came before its offer; those of older attempts are dropped.
      const pending = pendingIceCandidates.get(userId) ?? [];
      pendingIceCandidates.delete(userId);
      for (const { candidate } of pending.filter((pending) => pending.session === session)) {
        await connection.addIceCandidate(candidate);
      }

      await sendToPhone(userId, { type: "answer", sdp: answerSdp, from, to: userId, session });
    } catch (error) {
      console.error(`[WebRTC] Failed to handle offer from ${userId}:`, error);
      dispose();
    }
  };

  const handleIceCandidate = async (userId: string, candidate: string, session: string | undefined) => {
    const connection = connections.get(userId);
    if (connection && connection.session === session) {
      await connection.addIceCandidate(candidate);
      return;
    }
    // No connection yet, or this belongs to a newer attempt whose offer hasn't arrived.
    const pending = pendingIceCandidates.get(userId) ?? [];
    if (pending.length < MAX_PENDING_CANDIDATES) pending.push({ candidate, session });
    pendingIceCandidates.set(userId, pending);
  };

  const startSignaling = async () => {
    const id = lobbyStore.lobby()?.lobby.id;
    if (abortController || !id) return;

    const controller = new AbortController();
    abortController = controller;
    const generation: Generation = { signal: controller.signal, lobbyId: id };

    // The stream ends when the API restarts, the network blips or a proxy times it out; without it
    // no phone can join, so it's reopened (waiting longer after each failure) for as long as this
    // lobby lasts.
    let failures = 0;
    try {
      while (!controller.signal.aborted && lobbyStore.lobby()?.lobby.id === id) {
        const openedAt = Date.now();
        try {
          const iterator = await orpcClient.signaling.subscribeAsHost(undefined, { signal: controller.signal });

          for await (const signal of iterator) {
            if (controller.signal.aborted) break;
            failures = 0;

            const userId = signal.from;
            if (signal.type === "offer") {
              enqueue(generation, userId, () => handleOffer(generation, userId, signal.sdp, signal.session));
            } else if (signal.type === "ice-candidate") {
              enqueue(generation, userId, () => handleIceCandidate(userId, signal.candidate, signal.session));
            } else if (signal.type === "goodbye") {
              console.log(`[WebRTC] Received goodbye from ${userId}, reason: ${signal.reason ?? "unknown"}`);
              enqueue(generation, userId, async () => {
                // A goodbye from an older attempt (e.g. a tab closing after its reload connected) is ignored.
                const connection = connections.get(userId);
                if (signal.session === undefined || connection?.session === signal.session) closeConnection(userId);
              });
            }
          }
        } catch (error) {
          if (controller.signal.aborted) break;
          console.error("[WebRTC] Signaling subscription error:", error);
        }

        // A stream that keeps dying right after opening backs off; one that lasted starts over.
        if (Date.now() - openedAt >= HEALTHY_SUBSCRIPTION_MS) failures = 0;
        await abortableSleep(Math.min(RECONNECT_MAX_MS, 1000 * 2 ** failures++), controller.signal);
      }
    } finally {
      // A stop + restart may already have replaced this subscription.
      if (abortController === controller) abortController = null;
    }
  };

  /** Stops listening for signals and closes every phone's connection. */
  const stopSignaling = () => {
    abortController?.abort();
    abortController = null;

    for (const connection of connections.values()) {
      connection.close();
    }
    connections.clear();
    pendingIceCandidates.clear();
  };

  const closeConnection = (userId: string) => {
    connections.get(userId)?.close();
    connections.delete(userId);
    pendingIceCandidates.delete(userId);
  };

  return {
    startSignaling,
    stopSignaling,
    closeConnection,
  };
}

export const webrtcStore = createWebRTCStore();

/** Listens for phones while there's a lobby; a different lobby starts over. */
export function useWebRTCAutoConnect() {
  // The lobby lives in the settings store, which changes for unrelated reasons (e.g. a local player
  // added); only a different lobby id may restart signaling and drop the phones.
  const lobbyId = createMemo(() => lobbyStore.lobby()?.lobby.id);
  createEffect(
    on(lobbyId, (lobbyId) => {
      untrack(() => {
        webrtcStore.stopSignaling();
        if (lobbyId) void webrtcStore.startSignaling();
      });
    }),
  );

  onCleanup(() => {
    webrtcStore.stopSignaling();
  });
}
