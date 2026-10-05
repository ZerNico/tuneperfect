import { createFileRoute, Outlet, useNavigate } from "@tanstack/solid-router";
import { WEBRTC_CONFIG } from "@tuneperfect/webrtc/utils";
import { type Component, createEffect, createMemo, createRoot, type JSX, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import IconCircleNotch from "~icons/ph/circle-notch-bold";
import IconWifiSlash from "~icons/ph/wifi-slash-bold";

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
            <ConnectionOverlay>
              <ConnectionState icon={IconCircleNotch} spinning title={t("songs.connecting")}>
                {t("songs.connectionTrouble")}
              </ConnectionState>
            </ConnectionOverlay>
          </Show>

          <Show when={hasFailed()}>
            <ConnectionOverlay>
              <ConnectionState
                icon={IconWifiSlash}
                failed
                title={t("songs.connectionFailed")}
                action={
                  <Button intent="gradient" class="w-full" onClick={handleReturnToLobby}>
                    {t("lobby.backToLobby")}
                  </Button>
                }
              >
                {t("songs.connectionFailedHint")}
              </ConnectionState>
            </ConnectionOverlay>
          </Show>
        </GameClientProvider>
      )}
    </Show>
  );
}

function ConnectionPendingUI() {
  return (
    <main class="flex grow items-center justify-center px-6">
      <ConnectionState icon={IconCircleNotch} spinning title={t("songs.connecting")} />
    </main>
  );
}

function ConnectionErrorUI() {
  const navigate = useNavigate();

  return (
    <main class="flex grow items-center justify-center px-6">
      <ConnectionState
        icon={IconWifiSlash}
        failed
        title={t("songs.connectionFailed")}
        action={
          <Button intent="gradient" class="w-full" onClick={() => navigate({ to: "/" })}>
            {t("lobby.backToLobby")}
          </Button>
        }
      />
    </main>
  );
}

/** Dims the page and shows a state card over it, like a dialog. */
function ConnectionOverlay(props: { children: JSX.Element }) {
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div class="w-full max-w-sm rounded-[20px] surface-raised p-6">{props.children}</div>
    </div>
  );
}

/** Connecting / connection lost: an icon badge, a title, an optional explanation and action. */
function ConnectionState(props: {
  icon: Component<{ class?: string }>;
  title: JSX.Element;
  children?: JSX.Element;
  action?: JSX.Element;
  spinning?: boolean;
  failed?: boolean;
}) {
  return (
    <div class="flex w-full max-w-sm flex-col items-center gap-3 text-center">
      <span
        class="mb-1 flex size-14 items-center justify-center rounded-[16px] text-3xl"
        classList={{ "gradient-accent shadow-crisp": !props.failed, "bg-red-500/20 text-red-300": props.failed }}
      >
        <Dynamic component={props.icon} class={props.spinning ? "animate-spin" : undefined} />
      </span>
      <h2 class="text-xl font-bold">{props.title}</h2>
      <Show when={props.children}>
        <p class="text-white/60">{props.children}</p>
      </Show>
      <Show when={props.action}>
        <div class="mt-2 w-full">{props.action}</div>
      </Show>
    </div>
  );
}
