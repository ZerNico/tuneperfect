import { useMutation, useQuery } from "@tanstack/solid-query";
import { useNavigate } from "@tanstack/solid-router";
import { createEffect, Match, Switch } from "solid-js";

import TagChip from "~/components/fx/tag-chip";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import LoadingPanel from "~/components/loading-panel";
import type { MenuItem } from "~/components/menu";
import Menu from "~/components/menu";
import { platform } from "~/lib/desktop";
import { t } from "~/lib/i18n";
import { native } from "~/lib/native/client";

export default function RouteScreen() {
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

  const retryInstall = () => {
    installUpdateMutation.reset();
    installUpdateMutation.mutate();
  };

  const installFailedMenuItems: MenuItem[] = [
    {
      type: "button",
      label: t("update.retry"),
      action: retryInstall,
    },
    {
      type: "button",
      label: t("update.continue"),
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
            <LoadingPanel title="Tune Perfect" progress={null} detail={t("update.checking")} />
          </div>
        </Match>

        <Match when={installUpdateMutation.isPending}>
          <div class="flex grow items-center justify-center">
            <LoadingPanel title={t("update.installing")} progress={null} />
          </div>
        </Match>

        <Match when={checkUpdateQuery.isError}>
          <div class="flex w-full grow flex-col justify-center">
            <h1 class="mb-[10cqh] text-center text-5xl font-bold">{t("update.checkFailed")}</h1>
            <Menu items={errorMenuItems} gradient="gradient-settings" class="h-min grow-0" />
          </div>
        </Match>

        <Match when={installUpdateMutation.isError}>
          <div class="flex w-full grow flex-col justify-center">
            <h1 class="mb-[10cqh] text-center text-5xl font-bold">{t("update.installFailed")}</h1>
            <Menu items={installFailedMenuItems} gradient="gradient-settings" class="h-min grow-0" />
          </div>
        </Match>

        <Match when={checkUpdateQuery.isSuccess && checkUpdateQuery.data}>
          {(update) => (
            <div class="flex w-full grow flex-col justify-center">
              <div class="mb-[10cqh] flex flex-col items-center gap-3">
                <h1 class="text-center text-6xl font-bold">{t("update.available")}</h1>
                <TagChip label={t("update.version")} accent={update()?.version} class="text-lg" />
              </div>
              <Menu items={updateMenuItems} gradient="gradient-settings" class="h-min grow-0" />
            </div>
          )}
        </Match>
      </Switch>
    </Layout>
  );
}
