import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import IconDesktop from "~icons/ph/desktop-bold";
import IconDeviceMobile from "~icons/ph/device-mobile-bold";
import IconSignOut from "~icons/ph/sign-out-bold";

import PageHeader from "~/components/page-header";
import { useDialog } from "~/lib/dialog";
import { locale, t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { notify } from "~/lib/toast";
import { describeUserAgent } from "~/lib/user-agent";

export const Route = createFileRoute("/_auth/devices")({
  component: DevicesComponent,
});

/** Within this, a login counts as in use right now (the app refreshes about every 5 minutes). */
const ACTIVE_NOW_MS = 10 * 60 * 1000;

function deviceName(userAgent: string) {
  const { browser, os } = describeUserAgent(userAgent);
  if (browser && os) return t("devices.browserOn", { browser, os });
  return browser ?? os ?? t("devices.unknown");
}

function timeAgo(date: Date) {
  const seconds = (date.getTime() - Date.now()) / 1000;
  const format = new Intl.RelativeTimeFormat(locale(), { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["day", 86_400],
    ["hour", 3_600],
    ["minute", 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return format.format(Math.round(seconds / size), unit);
  }
  return t("devices.justNow");
}

function DevicesComponent() {
  const queryClient = useQueryClient();
  const { showDialog } = useDialog();
  const sessionsQuery = useQuery(() => client.auth.sessions.queryOptions());
  const others = () => sessionsQuery.data?.filter((session) => !session.current) ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: client.auth.sessions.key() });

  const revokeMutation = useMutation(() =>
    client.auth.revokeSession.mutationOptions({
      onError: () => notify({ intent: "error", message: t("error.unknown") }),
      onSuccess: () => notify({ intent: "success", message: t("devices.signedOut") }),
      onSettled: refresh,
    }),
  );

  const revokeOthersMutation = useMutation(() =>
    client.auth.revokeOtherSessions.mutationOptions({
      onError: () => notify({ intent: "error", message: t("error.unknown") }),
      onSuccess: () => notify({ intent: "success", message: t("devices.signedOutOthers") }),
      onSettled: refresh,
    }),
  );

  const signOutDevice = async (id: string, name: string) => {
    const confirmed = await showDialog({
      title: t("devices.signOutTitle"),
      description: t("devices.signOutDescription", { device: name }),
      confirmLabel: t("devices.signOut"),
      intent: "delete",
    });
    if (confirmed) revokeMutation.mutate({ id });
  };

  const signOutOthers = async () => {
    const confirmed = await showDialog({
      title: t("devices.signOutOthersTitle"),
      description: t("devices.signOutOthersDescription"),
      confirmLabel: t("devices.signOutOthers"),
      intent: "delete",
    });
    if (confirmed) revokeOthersMutation.mutate({});
  };

  return (
    <main class="mx-auto flex w-full max-w-md grow flex-col px-6 pt-4 pb-8">
      <PageHeader title={t("devices.title")} subtitle={t("devices.subtitle")} />

      <Show
        when={sessionsQuery.data}
        fallback={
          <div class="flex flex-col gap-2">
            <div class="h-20 animate-pulse rounded-[12px] bg-white/7" />
            <div class="h-20 animate-pulse rounded-[12px] bg-white/7" />
          </div>
        }
      >
        {(sessions) => (
          <ul class="flex flex-col gap-2">
            <For each={sessions()}>
              {(session) => {
                const name = () => deviceName(session.userAgent);
                const mobile = () => describeUserAgent(session.userAgent).mobile;
                const activeNow = () => session.current || Date.now() - session.lastActiveAt.getTime() < ACTIVE_NOW_MS;
                return (
                  <li class="flex min-h-20 items-center gap-3 rounded-[12px] bg-white/7 py-3 pr-2 pl-4">
                    <span class="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/8 text-xl text-white/70">
                      <Show when={mobile()} fallback={<IconDesktop />}>
                        <IconDeviceMobile />
                      </Show>
                    </span>
                    <div class="flex min-w-0 grow flex-col">
                      <span class="truncate font-bold">{name()}</span>
                      <span class="text-sm text-white/55">
                        <Show when={session.current}>
                          <span class="font-bold text-white/80">{t("devices.thisDevice")}</span>
                          {" · "}
                        </Show>
                        {activeNow()
                          ? t("devices.activeNow")
                          : t("devices.lastActive", { time: timeAgo(session.lastActiveAt) })}
                      </span>
                      <span class="text-xs text-white/40">
                        {t("devices.signedIn", { time: timeAgo(session.createdAt) })}
                      </span>
                    </div>
                    <Show when={!session.current}>
                      <button
                        type="button"
                        class="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-xl text-red-300 transition-colors hover:bg-red-400/10 disabled:opacity-40"
                        aria-label={t("devices.signOutNamed", { device: name() })}
                        disabled={revokeMutation.isPending}
                        onClick={() => void signOutDevice(session.id, name())}
                      >
                        <IconSignOut />
                      </button>
                    </Show>
                  </li>
                );
              }}
            </For>
          </ul>
        )}
      </Show>

      <Show when={others().length > 0}>
        <button
          type="button"
          class="mt-6 flex min-h-14 cursor-pointer items-center gap-3 rounded-[12px] bg-white/7 px-4 text-start font-bold text-red-300 transition-colors hover:bg-red-400/10 disabled:opacity-40"
          disabled={revokeOthersMutation.isPending}
          onClick={() => void signOutOthers()}
        >
          <IconSignOut class="text-xl" />
          {t("devices.signOutOthers")}
        </button>
      </Show>

      <p class="mt-4 text-center text-sm text-white/45">{t("devices.delayNote")}</p>
    </main>
  );
}
