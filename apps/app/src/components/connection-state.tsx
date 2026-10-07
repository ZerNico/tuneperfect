import { useNavigate, useRouter } from "@tanstack/solid-router";
import { type Component, type JSX, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import IconCircleNotch from "~icons/ph/circle-notch-bold";
import IconWifiSlash from "~icons/ph/wifi-slash-bold";

import Button from "~/components/ui/button";
import { t } from "~/lib/i18n";
import { connectionStore } from "~/stores/connection";

export function ConnectionPendingUI() {
  return (
    <main class="flex grow items-center justify-center px-6">
      <ConnectionState icon={IconCircleNotch} spinning title={t("songs.connecting")} />
    </main>
  );
}

/** The phone gave up connecting (or the route couldn't wait for it): retry, or go back to the lobby. */
export function ConnectionErrorUI() {
  const navigate = useNavigate();
  const router = useRouter();

  const retry = () => {
    connectionStore.retryConnection();
    // Runs the route's wait for the connection again.
    void router.invalidate();
  };

  return (
    <main class="flex grow items-center justify-center px-6">
      <ConnectionState
        icon={IconWifiSlash}
        failed
        title={t("songs.connectionFailed")}
        action={
          <div class="flex w-full flex-col gap-2">
            <Button intent="gradient" class="w-full" onClick={retry}>
              {t("songs.retry")}
            </Button>
            <Button class="w-full" onClick={() => navigate({ to: "/" })}>
              {t("lobby.backToLobby")}
            </Button>
          </div>
        }
      >
        {t("songs.connectionFailedHint")}
      </ConnectionState>
    </main>
  );
}

/** Dims the page and shows a state card over it, like a dialog. */
export function ConnectionOverlay(props: { children: JSX.Element }) {
  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6 backdrop-blur-sm">
      <div class="w-full max-w-sm rounded-[20px] surface-raised p-6">{props.children}</div>
    </div>
  );
}

/** Connecting / connection lost: an icon badge, a title, an optional explanation and action. */
export function ConnectionState(props: {
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
        classList={{ "gradient-accent": !props.failed, "bg-red-500/20 text-red-300": props.failed }}
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
