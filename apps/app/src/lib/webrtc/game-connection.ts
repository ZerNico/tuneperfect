import type { ClientContext } from "@orpc/client";
import { createORPCClient } from "@orpc/client";
import type { GameClient } from "@tuneperfect/webrtc/contracts/game";
import { RPCLink } from "@tuneperfect/webrtc/orpc/client";
import { RPCHandler } from "@tuneperfect/webrtc/orpc/server";
import { createHeartbeat, WEBRTC_CONFIG } from "@tuneperfect/webrtc/utils";
import { type Accessor, createEffect, createMemo, onCleanup } from "solid-js";

import { connectionStore } from "~/stores/connection";

import { appRouter } from "./router";

/**
 * The RPC client for the game over the lobby's WebRTC connection, or null while it isn't connected.
 * Also answers the game's calls to the app and keeps the connection alive with a heartbeat.
 * Create it once per lobby (the lobby layout does) so every lobby screen shares one link.
 */
export function createGameConnection(): Accessor<GameClient | null> {
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

  createEffect(() => {
    const connection = connectionStore.connection();
    if (!connection || !connectionStore.channelsReady()) return;

    const handler = new RPCHandler(appRouter);
    onCleanup(handler.upgrade(connection.appRpcChannel));
  });

  createEffect(() => {
    const game = client();
    if (!game) return;

    const heartbeat = createHeartbeat(
      async () => {
        await game.ping();
      },
      {
        interval: WEBRTC_CONFIG.heartbeat.interval,
        timeout: WEBRTC_CONFIG.heartbeat.timeout,
        onFailure: () => {
          console.warn("[WebRTC] Heartbeat failed, connection lost");
        },
      },
    );
    heartbeat.start();
    onCleanup(() => heartbeat.stop());
  });

  onCleanup(closeLink);

  return client;
}
