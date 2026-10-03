import { createFileRoute, Outlet, useNavigate } from "@tanstack/solid-router";
import { WEBRTC_CONFIG } from "@tuneperfect/webrtc/utils";
import { createEffect, createMemo, createRoot, Show } from "solid-js";
import IconLoaderCircle from "~icons/lucide/loader-circle";
import IconWifiOff from "~icons/lucide/wifi-off";

import Button from "~/components/ui/button";
import { GameClientProvider, useGameConnection } from "~/contexts/game-client";
import { t } from "~/lib/i18n";
import { connectionStore } from "~/stores/connection";

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
  const gameClient = useGameConnection();

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
              <div class="flex flex-col items-center gap-4 rounded-xl bg-slate-800 p-8">
                <IconLoaderCircle class="h-12 w-12 animate-spin text-blue-400" />
                <p class="text-white">{t("songs.connecting")}</p>
                <p class="text-sm text-white/60">{t("songs.connectionTrouble")}</p>
              </div>
            </div>
          </Show>

          <Show when={hasFailed()}>
            <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div class="flex flex-col items-center gap-4 rounded-xl bg-slate-800 p-8">
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
    <div class="container mx-auto flex w-full grow flex-col items-center justify-center p-4 sm:max-w-4xl">
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
    <div class="container mx-auto flex w-full grow flex-col items-center justify-center p-4 sm:max-w-4xl">
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
