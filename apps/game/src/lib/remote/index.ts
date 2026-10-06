import {
  type ActResult,
  type Extras,
  NAV_ACTIONS,
  type Panel,
  type RemoteAction,
  type RemoteState,
} from "@tuneperfect/webrtc/contracts/game";
import { createEffect, createRoot, createSignal, onCleanup, untrack } from "solid-js";

import { activeActions, pressRemote, releaseRemote, topLayer } from "~/hooks/navigation";
import { lobbyStore } from "~/stores/lobby";

/**
 * Phones controlling the game (see `remoteContract` in `@tuneperfect/webrtc`).
 *
 * Screens offer phones something to do with `useRemoteSurface`: what each user sees (a panel) and
 * what happens on their actions. The last mounted surface is the one phones talk to. Players with
 * full control (granted in the lobby) also get the game's own buttons: the ones the current
 * screen reacts to (see `useNavigation`'s `actions`). Where a pad is clumsy, screens add extras
 * with `useRemoteExtras` (typing text, picking the song select's sort and filters).
 */

type ExtraAction = Extract<RemoteAction, { surface: string }>;

/** What a screen offers phones with full control on top of the pad. Getters are reactive. */
export interface RemoteExtras {
  /** Like `useNavigation`'s: the extras count while this layer gets input. False: always. Default 0. */
  layer?: number | false;
  /** The TV wants text right now. */
  text?: () => {
    label: string;
    value: string;
    maxLength?: number;
    secret?: boolean;
    set: (value: string) => void;
  } | null;
  /** The song select's sort and filters. */
  songs?: () =>
    | (Omit<NonNullable<Extras["songs"]>, "surface"> & {
        setSort: (sort: string) => ActResult;
        setFilter: (filter: string, value: string | null) => ActResult;
      })
    | null;
}

export interface RemoteSurface {
  /** What `userId` sees right now; reactive. Null when there's nothing for them here. */
  panel: (userId: string) => { panel: Panel; attention?: boolean } | null;
  act?: (userId: string, action: Exclude<RemoteAction, { type: "nav" } | ExtraAction>) => ActResult;
}

export const NOT_ALLOWED: ActResult = { ok: false, reason: "not-allowed" };
export const STALE: ActResult = { ok: false, reason: "stale" };
export const UNAVAILABLE: ActResult = { ok: false, reason: "unavailable" };
export const OK: ActResult = { ok: true };

const [surfaces, setSurfaces] = createSignal<RemoteSurface[]>([]);
const activeSurface = () => surfaces().at(-1);

/** Offers phones `surface` while the calling component is mounted. */
export function useRemoteSurface(surface: RemoteSurface) {
  setSurfaces((current) => [...current, surface]);
  onCleanup(() => setSurfaces((current) => current.filter((other) => other !== surface)));
}

interface ExtrasRegistration {
  /** Tells mounted extras apart, also two visits of the same screen. */
  id: string;
  extras: RemoteExtras;
}

let nextExtrasId = 0;
const [extrasList, setExtrasList] = createSignal<ExtrasRegistration[]>([]);

/** Offers phones with full control `extras` while the calling component is mounted. */
export function useRemoteExtras(extras: RemoteExtras) {
  const registration = { id: `x${nextExtrasId++}`, extras };
  setExtrasList((current) => [...current, registration]);
  onCleanup(() => setExtrasList((current) => current.filter((other) => other !== registration)));
}

/** The newest registration of the input layer (or layer-less) offering `kind` right now. */
const extraOf = <K extends "text" | "songs">(kind: K) => {
  const list = extrasList();
  for (let i = list.length - 1; i >= 0; i--) {
    const { id, extras } = list[i]!;
    const layer = extras.layer ?? 0;
    if (layer !== false && layer !== topLayer()) continue;
    const value = extras[kind]?.() as ReturnType<NonNullable<RemoteExtras[K]>> | null | undefined;
    if (value) return { id, value };
  }
  return null;
};

const currentExtras = (): Extras => {
  const text = extraOf("text");
  const songs = extraOf("songs");
  return {
    text: text
      ? {
          surface: text.id,
          label: text.value.label,
          // A password is never sent to phones; they only type a new one.
          value: text.value.secret ? "" : text.value.value,
          maxLength: text.value.maxLength,
          secret: text.value.secret,
        }
      : undefined,
    songs: songs
      ? {
          surface: songs.id,
          sort: songs.value.sort,
          sorts: songs.value.sorts,
          filters: songs.value.filters,
          song: songs.value.song,
        }
      : undefined,
  };
};

const actExtra = (action: ExtraAction): ActResult => {
  if (action.type === "text") {
    const text = extraOf("text");
    if (text?.id !== action.surface) return STALE;
    const { maxLength, set } = text.value;
    set(maxLength === undefined ? action.value : action.value.slice(0, maxLength));
    return OK;
  }
  const songs = extraOf("songs");
  if (songs?.id !== action.surface) return STALE;
  return action.type === "songs.sort"
    ? songs.value.setSort(action.sort)
    : songs.value.setFilter(action.filter, action.value);
};

const hasFullControl = (userId: string) => lobbyStore.remoteControlIds().includes(userId);

/** What a phone with full control can press on this screen: what it offers, minus game-only keys (fullscreen). */
const remoteActions = () =>
  NAV_ACTIONS.flatMap((action) => {
    const enabled = activeActions().get(action);
    return enabled === undefined ? [] : [{ action, enabled }];
  });

const [screen, setScreen] = createSignal("");

/** Tells phones which screen the game is on; the root screen calls this with the route's path. */
export function useRemoteScreen(path: () => string) {
  createEffect(() => setScreen(path()));
}

/** What `userId`'s phone shows; reactive. */
function stateFor(userId: string): RemoteState {
  const current = activeSurface()?.panel(userId) ?? null;
  const full = hasFullControl(userId);
  return {
    control: full ? "full" : "none",
    actions: full ? remoteActions() : [],
    screen: screen(),
    panel: current?.panel ?? null,
    attention: current?.attention ?? false,
    extras: full ? currentExtras() : undefined,
  };
}

/** An action from `userId`'s phone. */
export function dispatchRemote(userId: string, action: RemoteAction): ActResult {
  if (action.type === "nav") {
    if (!hasFullControl(userId)) return NOT_ALLOWED;
    // A release always goes through, so nothing stays held.
    if (action.state === "up") {
      pressRemote(userId, action.action, "up");
      return OK;
    }
    // The screen changed since the phone got its buttons.
    if (!activeActions().get(action.action)) return STALE;
    pressRemote(userId, action.action, action.state ?? "tap");
    return OK;
  }
  if ("surface" in action) {
    if (!hasFullControl(userId)) return NOT_ALLOWED;
    return untrack(() => actExtra(action));
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
    // Gone (or in the background): it can't let go of what it holds anymore.
    releaseRemote(userId);
  }
}
