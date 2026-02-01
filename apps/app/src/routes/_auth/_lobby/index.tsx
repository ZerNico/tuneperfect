import { useQuery } from "@tanstack/solid-query";
import { createFileRoute, Link } from "@tanstack/solid-router";
import { type Component, createMemo, For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { sessionQueryOptions } from "~/lib/auth";
import { t } from "~/lib/i18n";
import { connectionStore, startConnection, stopConnection } from "~/stores/connection";
import IconCheck from "~icons/lucide/check";
import IconLoaderCircle from "~icons/lucide/loader-circle";
import IconMusic from "~icons/lucide/music";
import IconRefreshCw from "~icons/lucide/refresh-cw";
import IconUsers from "~icons/lucide/users";
import IconWifiOff from "~icons/lucide/wifi-off";

export const Route = createFileRoute("/_auth/_lobby/")({
  component: LobbyMainComponent,
});

function LobbyMainComponent() {
  const session = useQuery(() => sessionQueryOptions());

  // Connection state helpers
  const isConnecting = createMemo(
    () => connectionStore.connectionState() === "connecting" || connectionStore.connectionState() === "new",
  );
  const isConnected = createMemo(
    () => connectionStore.connectionState() === "connected" && connectionStore.channelsReady(),
  );
  const hasConnectionFailed = createMemo(() => connectionStore.connectionState() === "failed");

  const handleRetryConnection = () => {
    const userId = session.data?.id;
    if (userId) {
      stopConnection();
      startConnection(userId);
    }
  };

  const cards = [
    {
      label: t("lobby.playersTitle"),
      description: t("lobby.playersDescription"),
      gradient: "gradient-lobby",
      icon: IconUsers,
      to: "/players" as const,
      requiresConnection: false,
    },
    {
      label: t("lobby.songsTitle"),
      description: t("lobby.songsDescription"),
      gradient: "gradient-sing",
      icon: IconMusic,
      to: "/songs" as const,
      requiresConnection: true,
    },
  ];

  return (
    <div class="container mx-auto flex w-full flex-grow flex-col p-4 sm:max-w-4xl">
      <div class="mb-6">
        <h1 class="font-bold text-3xl">{t("lobby.title")}</h1>

        {/* Connection status indicator */}
        <div class="mt-2 flex items-center gap-2">
          <Show when={isConnecting()}>
            <IconLoaderCircle class="h-4 w-4 animate-spin text-blue-400" />
            <span class="text-sm text-white/70">{t("songs.connecting")}</span>
          </Show>
          <Show when={isConnected()}>
            <IconCheck class="h-4 w-4 text-green-400" />
            <span class="text-sm text-white/70">{t("lobby.connected")}</span>
          </Show>
          <Show when={hasConnectionFailed()}>
            <IconWifiOff class="h-4 w-4 text-red-400" />
            <span class="text-sm text-red-400">{t("songs.connectionFailed")}</span>
            <button
              type="button"
              onClick={handleRetryConnection}
              class="ml-2 flex items-center gap-1 rounded-md bg-white/10 px-2 py-1 text-sm text-white transition-colors hover:bg-white/20"
            >
              <IconRefreshCw class="h-3 w-3" />
              {t("songs.retry")}
            </button>
          </Show>
        </div>
      </div>

      <div class="flex flex-col gap-4">
        <For each={cards}>
          {(card) => (
            <LobbyCard
              label={card.label as string}
              description={card.description as string}
              gradient={card.gradient}
              icon={card.icon}
              to={card.to}
              disabled={card.requiresConnection && !isConnected()}
              disabledReason={
                card.requiresConnection
                  ? hasConnectionFailed()
                    ? t("songs.connectionFailed")
                    : t("songs.connecting")
                  : undefined
              }
            />
          )}
        </For>
      </div>
    </div>
  );
}

interface LobbyCardProps {
  label: string;
  description: string;
  gradient: string;
  icon: Component<{ class?: string }>;
  to: "/players" | "/songs";
  disabled?: boolean;
  disabledReason?: string;
}

function LobbyCard(props: LobbyCardProps) {
  return (
    <Show
      when={!props.disabled}
      fallback={
        <div class="group flex cursor-not-allowed overflow-hidden rounded-xl bg-white/50 shadow-lg opacity-60">
          <div
            class="flex w-24 flex-shrink-0 items-center justify-center bg-gradient-to-br p-4 opacity-50"
            classList={{
              [props.gradient]: true,
            }}
          >
            <Dynamic component={props.icon} class="h-10 w-10 text-white" />
          </div>
          <div class="flex flex-grow flex-col justify-center p-4">
            <div class="font-semibold text-lg text-slate-800">{props.label}</div>
            <div class="text-slate-500 text-sm">{props.disabledReason ?? props.description}</div>
          </div>
        </div>
      }
    >
      <Link
        to={props.to}
        class="group flex cursor-pointer overflow-hidden rounded-xl bg-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]"
      >
        <div
          class="flex w-24 flex-shrink-0 items-center justify-center bg-gradient-to-br p-4"
          classList={{
            [props.gradient]: true,
          }}
        >
          <Dynamic component={props.icon} class="h-10 w-10 text-white" />
        </div>
        <div class="flex flex-grow flex-col justify-center p-4">
          <div class="font-semibold text-lg text-slate-800">{props.label}</div>
          <div class="text-slate-500 text-sm">{props.description}</div>
        </div>
      </Link>
    </Show>
  );
}
