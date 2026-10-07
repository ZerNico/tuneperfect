import { createORPCClient } from "@orpc/client";
import { useQueryClient } from "@tanstack/solid-query";
import type { GameClient } from "@tuneperfect/webrtc/contracts/game";
import { createHeartbeat, WEBRTC_CONFIG } from "@tuneperfect/webrtc/utils";
import { type Accessor, createEffect, createMemo, createSignal, onCleanup } from "solid-js";

import { isSongListCurrent, songsQueryKey } from "~/lib/game-query";
import { connectionStore } from "~/stores/connection";

import { GameLink } from "./game-link";

export interface GameConnection {
  /** The RPC client for the game, or null while it isn't connected. */
  client: Accessor<GameClient | null>;
  /** What the connected game supports (see its `ping`); undefined until it answered, or while not connected. */
  features: Accessor<readonly string[] | undefined>;
}

/**
 * The RPC client for the game over the lobby's WebRTC connection.
 * Keeps the connection alive with a heartbeat, which also tells when the game's library changed.
 * Create it once per lobby (the lobby layout does) so every lobby screen shares one link.
 */
export function createGameConnection(): GameConnection {
  const queryClient = useQueryClient();
  const [features, setFeatures] = createSignal<readonly string[] | undefined>(undefined, {
    // Every heartbeat reports them: only a real change should reach the screens
    equals: (a, b) => a?.join() === b?.join(),
  });
  let link: GameLink | null = null;
  /** The client the last heartbeat ran for, to tell a new connection from the page coming back. */
  let pingedClient: GameClient | null = null;

  const closeLink = () => {
    link?.close();
    link = null;
    setFeatures(undefined);
  };

  const client = createMemo(() => {
    const connection = connectionStore.connection();
    if (!connection || !connectionStore.channelsReady()) {
      closeLink();
      return null;
    }

    link ??= new GameLink({ main: connection.gameRpcChannel, control: connection.gameControlChannel }, setFeatures);
    return createORPCClient(link) as GameClient;
  });

  // Runs while connected and in the foreground: a reconnect or a recovered connection starts it over,
  // so a heartbeat that failed while the connection was down doesn't stay stopped. In the background
  // the phone may be frozen mid-ping, and that ping's timeout would fire on coming back although
  // nothing is wrong, so it pauses there and pings right away on coming back.
  createEffect(() => {
    // This run's client: the effect runs again (with a new heartbeat) whenever the client changes.
    // oxlint-disable-next-line solid/reactivity
    const game = client();
    if (!game || connectionStore.status() !== "connected" || !connectionStore.visible()) return;

    // The song list is only fetched again when the game's library changed (a game restarted with
    // other songs, a folder added), not every time the phone comes back to the tab.
    let firstPing = game !== pingedClient;
    pingedClient = game;
    const ping = async () => {
      const { libraryVersion } = await game.ping();
      // Nothing cached yet: the first fetch is still coming and brings its own version.
      const cached = queryClient.getQueryData(songsQueryKey) !== undefined;
      if (cached && !isSongListCurrent(libraryVersion, firstPing)) {
        void queryClient.invalidateQueries({ queryKey: songsQueryKey });
      }
      firstPing = false;
    };

    void ping().catch(() => {});
    const heartbeat = createHeartbeat(ping, {
      interval: WEBRTC_CONFIG.heartbeat.interval,
      timeout: WEBRTC_CONFIG.heartbeat.timeout,
      onFailure: () => {
        console.warn("[WebRTC] Heartbeat failed, reconnecting");
        connectionStore.reportConnectionLost();
      },
    });
    heartbeat.start();
    onCleanup(() => heartbeat.stop());
  });

  onCleanup(closeLink);

  return { client, features };
}
