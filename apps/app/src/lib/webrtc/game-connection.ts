import type { ClientContext } from "@orpc/client";
import { createORPCClient } from "@orpc/client";
import { useQueryClient } from "@tanstack/solid-query";
import type { GameClient } from "@tuneperfect/webrtc/contracts/game";
import { RPCLink } from "@tuneperfect/webrtc/orpc/client";
import { createHeartbeat, WEBRTC_CONFIG } from "@tuneperfect/webrtc/utils";
import { type Accessor, createEffect, createMemo, onCleanup } from "solid-js";

import { isSongListCurrent, songsQueryKey } from "~/lib/game-query";
import { connectionStore } from "~/stores/connection";

/**
 * The RPC client for the game over the lobby's WebRTC connection, or null while it isn't connected.
 * Keeps the connection alive with a heartbeat, which also tells when the game's library changed.
 * Create it once per lobby (the lobby layout does) so every lobby screen shares one link.
 */
export function createGameConnection(): Accessor<GameClient | null> {
  const queryClient = useQueryClient();
  let link: RPCLink<ClientContext> | null = null;

  const closeLink = () => {
    link?.close();
    link = null;
  };

  const client = createMemo(() => {
    const connection = connectionStore.connection();
    if (!connection || !connectionStore.channelsReady()) {
      closeLink();
      return null;
    }

    link ??= new RPCLink({ channel: connection.gameRpcChannel });
    return createORPCClient(link) as GameClient;
  });

  // Runs while connected: a reconnect or a recovered connection starts it over, so a heartbeat that
  // failed while the connection was down doesn't stay stopped.
  createEffect(() => {
    // This run's client: the effect runs again (with a new heartbeat) whenever the client changes.
    // oxlint-disable-next-line solid/reactivity
    const game = client();
    if (!game || connectionStore.status() !== "connected") return;

    // The song list is only fetched again when the game's library changed (a game restarted with
    // other songs, a folder added), not every time the phone comes back to the tab.
    let firstPing = true;
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

  return client;
}
