import {
  type GameClient,
  REMOTE_FEATURE,
  type RemoteAction,
  type RemoteState,
} from "@tuneperfect/webrtc/contracts/game";
import { type Accessor, createContext, createEffect, createSignal, type JSX, onCleanup, useContext } from "solid-js";

import { connectionStore } from "~/stores/connection";

/**
 * Controlling the game from the phone (see `remoteContract` in `@tuneperfect/webrtc`): the game
 * sends what this user can do right now, the phone sends actions back.
 */
export interface Remote {
  /** Whether the game takes part (older games don't); undefined until it said. */
  supported: Accessor<boolean | undefined>;
  /** The latest state from the game; null until there is one, or while not connected. */
  state: Accessor<RemoteState | null>;
  act: (action: RemoteAction) => void;
}

/** How long to wait before following the game again after its stream failed. */
const RETRY_MS = 3000;

/** Follows the game's remote state while connected. Create it once per lobby (the lobby layout does). */
export function createRemote(client: Accessor<GameClient | null>): Remote {
  const [supported, setSupported] = createSignal<boolean>();
  const [state, setState] = createSignal<RemoteState | null>(null);
  /** Bumped to follow the game again after the stream broke off while connected. */
  const [attempt, setAttempt] = createSignal(0);

  createEffect(() => {
    // oxlint-disable-next-line solid/reactivity
    const game = client();
    if (!game || connectionStore.status() !== "connected") {
      setState(null);
      return;
    }
    // In the background the state just stops updating; coming back subscribes again and gets it fresh.
    if (!connectionStore.visible()) return;
    attempt();

    const controller = new AbortController();
    const { signal } = controller;
    void (async () => {
      try {
        const { features } = await game.ping(undefined, { signal });
        const available = features?.includes(REMOTE_FEATURE) ?? false;
        setSupported(available);
        if (!available) return;

        for await (const next of await game.remote.watch(undefined, { signal })) setState(next);
      } catch (error) {
        // A dropped connection runs this effect again once it's back. Otherwise try again in a moment.
        if (signal.aborted) return;
        console.warn("[Remote] Stopped following the game:", error);
        const retry = setTimeout(() => setAttempt((current) => current + 1), RETRY_MS);
        signal.addEventListener("abort", () => clearTimeout(retry));
      }
    })();
    onCleanup(() => controller.abort());
  });

  const act = (action: RemoteAction) => {
    const game = client();
    if (!game) return;
    if (!("state" in action) || action.state !== "up") navigator.vibrate?.(10);
    // Turned down actions need no message: the game's next state shows what's possible instead.
    game.remote.act(action).catch((error: unknown) => console.warn("[Remote] Action failed:", error));
  };

  return { supported, state, act };
}

const RemoteContext = createContext<Remote>();

export function RemoteProvider(props: { remote: Remote; children: JSX.Element }) {
  // oxlint-disable-next-line solid/reactivity
  return <RemoteContext.Provider value={props.remote}>{props.children}</RemoteContext.Provider>;
}

export function useRemote() {
  const context = useContext(RemoteContext);
  if (!context) throw new Error("useRemote must be used within RemoteProvider");
  return context;
}
