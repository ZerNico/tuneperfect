import type { ActResult, Panel, RemoteAction, RemoteState } from "@tuneperfect/webrtc/contracts/game";
import { createEffect, createRoot, createSignal, onCleanup } from "solid-js";

import { pressRemote } from "~/hooks/navigation";
import { lobbyStore } from "~/stores/lobby";

/**
 * Phones controlling the game (see `remoteContract` in `@tuneperfect/webrtc`).
 *
 * Screens offer phones something to do with `useRemoteSurface`: what each user sees (a panel) and
 * what happens on their actions. The last mounted surface is the one phones talk to. Players with
 * full control (granted in the lobby) also get the game's own buttons, which work everywhere.
 */

export interface RemoteSurface {
  /** What `userId` sees right now; reactive. Null when there's nothing for them here. */
  panel: (userId: string) => { panel: Panel; attention?: boolean } | null;
  act?: (userId: string, action: Exclude<RemoteAction, { type: "nav" }>) => ActResult;
}

export const NOT_ALLOWED: ActResult = { ok: false, reason: "not-allowed" };
export const STALE: ActResult = { ok: false, reason: "stale" };
export const UNAVAILABLE: ActResult = { ok: false, reason: "unavailable" };
const OK: ActResult = { ok: true };

const [surfaces, setSurfaces] = createSignal<RemoteSurface[]>([]);
const activeSurface = () => surfaces().at(-1);

/** Offers phones `surface` while the calling component is mounted. */
export function useRemoteSurface(surface: RemoteSurface) {
  setSurfaces((current) => [...current, surface]);
  onCleanup(() => setSurfaces((current) => current.filter((other) => other !== surface)));
}

const hasFullControl = (userId: string) => lobbyStore.remoteControlIds().includes(userId);

/** What `userId`'s phone shows; reactive. */
function stateFor(userId: string): RemoteState {
  const current = activeSurface()?.panel(userId) ?? null;
  return {
    control: hasFullControl(userId) ? "full" : "none",
    panel: current?.panel ?? null,
    attention: current?.attention ?? false,
  };
}

/** An action from `userId`'s phone. */
export function dispatchRemote(userId: string, action: RemoteAction): ActResult {
  if (action.type === "nav") {
    if (!hasFullControl(userId)) return NOT_ALLOWED;
    pressRemote(userId, action.action);
    return OK;
  }
  return activeSurface()?.act?.(userId, action) ?? UNAVAILABLE;
}

/** `userId`'s state now and after every change, until `signal` aborts. Changes in between collapse into the latest. */
export async function* watchRemote(userId: string, signal?: AbortSignal): AsyncGenerator<RemoteState> {
  let pending: RemoteState | undefined;
  let sent = "";
  let wake: (() => void) | undefined;

  const dispose = createRoot((dispose) => {
    createEffect(() => {
      const state = stateFor(userId);
      // Surfaces recompute on unrelated changes; only send what's actually new.
      const serialized = JSON.stringify(state);
      if (serialized === sent) return;
      sent = serialized;
      pending = state;
      wake?.();
    });
    return dispose;
  });
  const onAbort = () => wake?.();
  signal?.addEventListener("abort", onAbort);

  try {
    for (;;) {
      if (signal?.aborted) return;
      if (!pending) {
        await new Promise<void>((resolve) => (wake = resolve));
        wake = undefined;
        continue;
      }
      const next = pending;
      pending = undefined;
      yield next;
    }
  } finally {
    signal?.removeEventListener("abort", onAbort);
    dispose();
  }
}
