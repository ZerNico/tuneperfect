import { useMutation, useQuery } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createEffect, Match, Switch } from "solid-js";
import IconLoaderCircle from "~icons/ph/spinner-gap-bold";

import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import type { MenuItem } from "~/components/menu";
import Menu from "~/components/menu";
import { platform } from "~/lib/desktop";
import { t } from "~/lib/i18n";
import { native } from "~/lib/native/client";
import { initializeLobbySettings } from "~/stores/lobby";
import { initializeLocalSettings } from "~/stores/local";
import { initializeSettings } from "~/stores/settings";
import { initializeUsdbStore } from "~/stores/usdb";

export const Route = createFileRoute("/")({
  component: RouteComponent,
  loader: async () => {
    await Promise.all([
      initializeSettings(),
      initializeLocalSettings(),
      initializeLobbySettings(),
      initializeUsdbStore(),
    ]);
  },
});

function RouteComponent() {
  const navigate = useNavigate();

  const checkUpdateQuery = useQuery(() => ({
    queryKey: ["checkUpdate"],
    queryFn: () => native.updates.check(),
    retry: false,
  }));

  const askForMicrophonePermission = async () => {
    try {
      if (platform === "macos") {
        await native.microphones.list();
      }
    } catch (error) {
      console.error("Failed to get microphone permissions on startup:", error);
    }
  };

  const installUpdateMutation = useMutation(() => ({
    mutationFn: async () => {
      if (!checkUpdateQuery.data) return;
      // Streams download progress (not shown yet), then restarts into the new version.
      await Array.fromAsync(await native.updates.install());
    },
    onError: (error) => {
      console.error(error);
    },
  }));

  const skipUpdate = async () => {
    await askForMicrophonePermission();
    navigate({ to: "/create-lobby" });
  };

  createEffect(() => {
    if (checkUpdateQuery.isSuccess && !checkUpdateQuery.data) {
      void skipUpdate();
    }
  });

  const retryCheck = () => {
    checkUpdateQuery.refetch();
  };

  const installUpdate = () => {
    installUpdateMutation.mutate();
  };

  const updateMenuItems: MenuItem[] = [
    {
      type: "button",
      label: t("update.install"),
      action: installUpdate,
    },
    {
      type: "button",
      label: t("update.skip"),
      action: skipUpdate,
    },
  ];

  const errorMenuItems: MenuItem[] = [
    {
      type: "button",
      label: t("update.retry"),
      action: retryCheck,
    },
    {
      type: "button",
      label: t("update.continue"),
      action: skipUpdate,
    },
  ];

  return (
    <Layout intent="primary" footer={<KeyHints hints={["navigate", "confirm"]} />}>
      <Switch>
        <Match when={checkUpdateQuery.isPending}>
          <div class="flex grow items-center justify-center">
            <IconLoaderCircle class="animate-spin text-6xl" />
          </div>
        </Match>

        <Match when={installUpdateMutation.isPending}>
          <div class="flex grow items-center justify-center">
            <IconLoaderCircle class="animate-spin text-6xl" />
            <div class="ml-4 text-xl">{t("update.installing")}</div>
          </div>
        </Match>

        <Match when={checkUpdateQuery.isError}>
          <div class="flex w-full grow flex-col justify-center">
            <h1 class="mb-[10cqh] text-center text-4xl font-bold">{t("update.checkFailed")}</h1>
            <Menu items={errorMenuItems} gradient="gradient-settings" class="h-min grow-0" />
          </div>
        </Match>

        <Match when={installUpdateMutation.isError}>
          <div class="flex w-full grow flex-col justify-center">
            <h1 class="mb-[10cqh] text-center text-4xl font-bold">{t("update.installFailed")}</h1>
            <Menu items={errorMenuItems} gradient="gradient-settings" class="h-min grow-0" />
          </div>
        </Match>

        <Match when={checkUpdateQuery.isSuccess && checkUpdateQuery.data}>
          {(update) => (
            <div class="flex w-full grow flex-col justify-center">
              <h1 class="mb-4 text-center text-4xl font-bold">{t("update.available")}</h1>
              <div class="mb-[10cqh] text-center">
                <p class="text-xl">
                  {t("update.version")} {update()?.version}
                </p>
              </div>
              <Menu items={updateMenuItems} gradient="gradient-settings" class="h-min grow-0" />
            </div>
          )}
        </Match>
      </Switch>
    </Layout>
  );
}
