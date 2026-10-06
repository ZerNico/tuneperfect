import { createFileRoute, Outlet } from "@tanstack/solid-router";
import { WEBRTC_CONFIG } from "@tuneperfect/webrtc/utils";
import { type Accessor, createEffect, createMemo, createRoot, createSignal, onCleanup, Show } from "solid-js";
import IconCircleNotch from "~icons/ph/circle-notch-bold";

import {
  ConnectionErrorUI,
  ConnectionOverlay,
  ConnectionPendingUI,
  ConnectionState,
} from "~/components/connection-state";
import { GameClientProvider, useGameConnection } from "~/contexts/game-client";
import { t } from "~/lib/i18n";
import { connectionStore } from "~/stores/connection";

async function waitForChannelsReady() {
  return new Promise<void>((resolve, reject) => {
    if (connectionStore.status() === "connected") {
      resolve();
      return;
    }

    const timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error("Connection timeout"));
    }, WEBRTC_CONFIG.connectionTimeout + 5000);

    const cleanup = createRoot((dispose) => {
      createEffect(() => {
        const status = connectionStore.status();

        if (status === "connected") {
          clearTimeout(timeoutId);
          dispose();
          resolve();
        } else if (status === "failed") {
          clearTimeout(timeoutId);
          dispose();
          reject(new Error(connectionStore.error() ?? "Connection failed"));
        }
      });

      return dispose;
    });
  });
}

const OVERLAY_DELAY = 1_500;
const TROUBLE_DELAY = 10_000;

/** True once `when` has been true for `delay` ms in a row; false again as soon as it isn't. */
function createDelayed(when: Accessor<boolean>, delay: number) {
  const [delayed, setDelayed] = createSignal(false);
  createEffect(() => {
    if (!when()) {
      setDelayed(false);
      return;
    }
    const timer = setTimeout(() => setDelayed(true), delay);
    onCleanup(() => clearTimeout(timer));
  });
  return delayed;
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
  const gameClient = useGameConnection();

  const isReconnecting = createMemo(() => connectionStore.status() === "reconnecting");
  // A dropout often recovers within a moment (most of all when coming back to the tab), so the
  // overlay waits a little before covering the page, and longer before calling it trouble.
  const showOverlay = createDelayed(isReconnecting, OVERLAY_DELAY);
  const showTrouble = createDelayed(isReconnecting, TROUBLE_DELAY);
  const hasFailed = createMemo(() => connectionStore.status() === "failed");

  // Failing clears the connection, so the failed state can't live inside the connected branch.
  return (
    <Show when={!hasFailed()} fallback={<ConnectionErrorUI />}>
      <Show when={gameClient()} fallback={<ConnectionPendingUI />}>
        {(client) => (
          <GameClientProvider client={client()}>
            <Outlet />

            <Show when={showOverlay()}>
              <ConnectionOverlay>
                <ConnectionState icon={IconCircleNotch} spinning title={t("songs.connecting")}>
                  <Show when={showTrouble()}>{t("songs.connectionTrouble")}</Show>
                </ConnectionState>
              </ConnectionOverlay>
            </Show>
          </GameClientProvider>
        )}
      </Show>
    </Show>
  );
}
