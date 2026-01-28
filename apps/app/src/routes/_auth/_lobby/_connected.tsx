import { createFileRoute, Outlet, useNavigate } from "@tanstack/solid-router";
import { createMemo, Show } from "solid-js";
import Button from "~/components/ui/button";
import { t } from "~/lib/i18n";
import { waitForConnection, webrtcStore } from "~/stores/webrtc";
import IconLoaderCircle from "~icons/lucide/loader-circle";
import IconWifiOff from "~icons/lucide/wifi-off";

export const Route = createFileRoute("/_auth/_lobby/_connected")({
  // Wait for WebRTC connection before allowing navigation
  beforeLoad: async () => {
    await waitForConnection();
  },
  // Show loading UI while waiting for connection
  pendingComponent: ConnectionPendingUI,
  // Show error UI if connection fails during beforeLoad
  errorComponent: ConnectionErrorUI,
  component: ConnectedLayout,
});

/**
 * Layout for routes that require an active game connection.
 * Monitors connection state and shows overlay on disconnection.
 */
function ConnectedLayout() {
  const navigate = useNavigate();

  // Monitor connection state
  const isConnected = createMemo(() => webrtcStore.connectionState() === "connected");
  const isDisconnected = createMemo(() => {
    const state = webrtcStore.connectionState();
    return state === "disconnected" || state === "closed";
  });
  const hasFailed = createMemo(() => webrtcStore.connectionState() === "failed");
  const isReconnecting = createMemo(() => webrtcStore.isConnecting() && !isConnected());

  // Navigate back to lobby if connection permanently fails
  const handleReturnToLobby = () => {
    navigate({ to: "/" });
  };

  return (
    <>
      {/* Always render children to preserve cached data */}
      <Outlet />

      {/* Overlay when disconnected but reconnecting */}
      <Show when={isDisconnected() && isReconnecting()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div class="flex flex-col items-center gap-4 rounded-xl bg-slate-800 p-8 shadow-xl">
            <IconLoaderCircle class="h-12 w-12 animate-spin text-blue-400" />
            <p class="text-white">{t("songs.connecting")}</p>
            <p class="text-sm text-white/60">{t("songs.connectionTrouble")}</p>
          </div>
        </div>
      </Show>

      {/* Overlay when connection failed */}
      <Show when={hasFailed()}>
        <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div class="flex flex-col items-center gap-4 rounded-xl bg-slate-800 p-8 shadow-xl">
            <IconWifiOff class="h-12 w-12 text-red-400" />
            <p class="text-white">{t("songs.connectionFailed")}</p>
            <Show when={webrtcStore.error()}>
              <p class="text-sm text-red-400">{webrtcStore.error()}</p>
            </Show>
            <Button intent="gradient" onClick={handleReturnToLobby}>
              {t("lobby.title")}
            </Button>
          </div>
        </div>
      </Show>
    </>
  );
}

/**
 * Shown while waiting for connection in beforeLoad
 */
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

/**
 * Shown when connection fails during beforeLoad
 */
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
