import {
  type ActResult,
  NAV_ACTIONS,
  type NavAction,
  type Panel,
  type RemoteAction,
  type RemoteState,
} from "@tuneperfect/webrtc/contracts/game";
import { createEffect, createRoot, createSignal, onCleanup } from "solid-js";

import { activeActions, pressRemote } from "~/hooks/navigation";
import { lobbyStore } from "~/stores/lobby";

/**
 * Phones controlling the game (see `remoteContract` in `@tuneperfect/webrtc`).
 *
 * Screens offer phones something to do with `useRemoteSurface`: what each user sees (a panel) and
 * what happens on their actions. The last mounted surface is the one phones talk to. Players with
 * full control (granted in the lobby) also get the game's own buttons: the ones the current
 * screen reacts to (see `useNavigation`'s `actions`).
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

/** What a phone with full control can press right now: what the screen reacts to, minus game-only keys (fullscreen). */
const remoteActions = (): NavAction[] => NAV_ACTIONS.filter((action) => activeActions().has(action));

/** What `userId`'s phone shows; reactive. */
function stateFor(userId: string): RemoteState {
  const current = activeSurface()?.panel(userId) ?? null;
  const full = hasFullControl(userId);
  return {
    control: full ? "full" : "none",
    actions: full ? remoteActions() : [],
    panel: current?.panel ?? null,
    attention: current?.attention ?? false,
  };
}

/** An action from `userId`'s phone. */
export function dispatchRemote(userId: string, action: RemoteAction): ActResult {
  if (action.type === "nav") {
    if (!hasFullControl(userId)) return NOT_ALLOWED;
    // The screen changed since the phone got its buttons.
    if (!activeActions().has(action.action)) return STALE;
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
