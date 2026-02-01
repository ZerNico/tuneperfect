import type { ClientContext } from "@orpc/client";
import { createORPCClient } from "@orpc/client";
import { createFileRoute, Outlet, useNavigate } from "@tanstack/solid-router";
import type { GameClient } from "@tuneperfect/webrtc/contracts/game";
import { RPCLink } from "@tuneperfect/webrtc/orpc/client";
import { RPCHandler } from "@tuneperfect/webrtc/orpc/server";
import { createHeartbeat, WEBRTC_CONFIG } from "@tuneperfect/webrtc/utils";
import { createEffect, createMemo, createRoot, onCleanup, Show } from "solid-js";
import Button from "~/components/ui/button";
import { GameClientProvider } from "~/contexts/game-client";
import { t } from "~/lib/i18n";
import { appRouter } from "~/lib/webrtc/router";
import { connectionStore } from "~/stores/connection";
import IconLoaderCircle from "~icons/lucide/loader-circle";
import IconWifiOff from "~icons/lucide/wifi-off";

async function waitForChannelsReady() {
  return new Promise<void>((resolve, reject) => {
    if (connectionStore.channelsReady() && connectionStore.connectionState() === "connected") {
      resolve();
      return;
    }

    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("Connection timeout"));
    }, WEBRTC_CONFIG.connectionTimeout + 5000);

    const cleanup = createRoot((dispose) => {
      createEffect(() => {
        const state = connectionStore.connectionState();
        const ready = connectionStore.channelsReady();

        if (state === "connected" && ready) {
          clearTimeout(timeoutId);
          dispose();
          resolve();
        } else if (state === "failed") {
          clearTimeout(timeoutId);
          dispose();
          reject(new Error(connectionStore.error() ?? "Connection failed"));
        }
      });

      return dispose;
    });
  });
}

export const Route = createFileRoute("/_auth/_lobby/_connected")({
  beforeLoad: async () => {
    await waitForChannelsReady();
  },
  pendingComponent: ConnectionPendingUI,
  errorComponent: ConnectionErrorUI,
  component: ConnectedLayout,
});

function ConnectedLayout() {
  const navigate = useNavigate();

  let currentGameRpcLink: RPCLink<ClientContext> | null = null;

  const gameClient = createMemo(() => {
    const conn = connectionStore.connection();
    if (!conn || !connectionStore.channelsReady()) {
      if (currentGameRpcLink) {
        currentGameRpcLink.close();
        currentGameRpcLink = null;
      }
      return null;
    }

    if (currentGameRpcLink !== null) {
      return createORPCClient(currentGameRpcLink) as GameClient;
    }

    currentGameRpcLink = new RPCLink({ channel: conn.gameRpcChannel });
    return createORPCClient(currentGameRpcLink) as GameClient;
  });

  createEffect(() => {
    const conn = connectionStore.connection();
    if (!conn || !connectionStore.channelsReady()) return;

    const handler = new RPCHandler(appRouter);
    const cleanup = handler.upgrade(conn.appRpcChannel);

    onCleanup(cleanup);
  });

  createEffect(() => {
    const client = gameClient();
    if (!client) return;

    const heartbeat = createHeartbeat(
      async () => {
        await client.ping();
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

  onCleanup(() => {
    if (currentGameRpcLink) {
      currentGameRpcLink.close();
      currentGameRpcLink = null;
    }
  });

  const isConnected = createMemo(() => connectionStore.connectionState() === "connected");
  const isDisconnected = createMemo(() => {
    const state = connectionStore.connectionState();
    return state === "disconnected" || state === "closed";
  });
  const hasFailed = createMemo(() => connectionStore.connectionState() === "failed");
  const isReconnecting = createMemo(() => connectionStore.reconnectAttempts() > 0 && !isConnected());

  const handleReturnToLobby = () => {
    navigate({ to: "/" });
  };

  return (
    <Show when={gameClient()} fallback={<ConnectionPendingUI />}>
      {(client) => (
        <GameClientProvider client={client()}>
          <Outlet />

          <Show when={isDisconnected() && isReconnecting()}>
            <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div class="flex flex-col items-center gap-4 rounded-xl bg-slate-800 p-8 shadow-xl">
                <IconLoaderCircle class="h-12 w-12 animate-spin text-blue-400" />
                <p class="text-white">{t("songs.connecting")}</p>
                <p class="text-sm text-white/60">{t("songs.connectionTrouble")}</p>
              </div>
            </div>
          </Show>

          <Show when={hasFailed()}>
            <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div class="flex flex-col items-center gap-4 rounded-xl bg-slate-800 p-8 shadow-xl">
                <IconWifiOff class="h-12 w-12 text-red-400" />
                <p class="text-white">{t("songs.connectionFailed")}</p>
                <Show when={connectionStore.error()}>
                  <p class="text-sm text-red-400">{connectionStore.error()}</p>
                </Show>
                <Button intent="gradient" onClick={handleReturnToLobby}>
                  {t("lobby.title")}
                </Button>
              </div>
            </div>
          </Show>
        </GameClientProvider>
      )}
    </Show>
  );
}

function ConnectionPendingUI() {
  return (
    <div class="container mx-auto flex w-full flex-grow flex-col items-center justify-center p-4 sm:max-w-4xl">
      <div class="flex flex-col items-center gap-4">
        <IconLoaderCircle class="h-12 w-12 animate-spin text-blue-400" />
        <p class="text-white/70">{t("songs.connecting")}</p>
      </div>
    </div>
  );
}

function ConnectionErrorUI() {
  const navigate = useNavigate();

  const handleReturnToLobby = () => {
    navigate({ to: "/" });
  };

  return (
    <div class="container mx-auto flex w-full flex-grow flex-col items-center justify-center p-4 sm:max-w-4xl">
      <div class="flex flex-col items-center gap-4">
        <IconWifiOff class="h-12 w-12 text-red-400" />
        <p class="text-white/70">{t("songs.connectionFailed")}</p>
        <Button intent="gradient" onClick={handleReturnToLobby}>
          {t("lobby.title")}
        </Button>
      </div>
    </div>
  );
}
