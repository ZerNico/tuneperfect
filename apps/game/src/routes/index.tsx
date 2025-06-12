import { useMutation, useQuery } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { platform } from "@tauri-apps/plugin-os";
import { relaunch } from "@tauri-apps/plugin-process";
import { check } from "@tauri-apps/plugin-updater";
import { createEffect, Match, Switch } from "solid-js";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import type { MenuItem } from "~/components/menu";
import Menu from "~/components/menu";
import { t } from "~/lib/i18n";
import IconLoaderCircle from "~icons/lucide/loader-circle";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = useNavigate();

  const checkUpdateQuery = useQuery(() => ({
    queryKey: ["checkUpdate"],
    queryFn: async () => {
      const update = await check();
      return update;
    },
    retry: false,
  }));

  const askForMicrophonePermission = async () => {
    try {
      const currentPlatform = platform();
      if (currentPlatform === "macos") {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      }
    } catch (error) {
      console.error("Failed to get microphone permissions on startup:", error);
    }
  };

  createEffect(async () => {
    if (checkUpdateQuery.isSuccess && !checkUpdateQuery.data) {
      await askForMicrophonePermission();
      navigate({ to: "/create-lobby" });
    }
  });

  const installUpdateMutation = useMutation(() => ({
    mutationFn: async () => {
      const update = checkUpdateQuery.data;
      if (update) {
        await update.downloadAndInstall();
        await relaunch();
      }
    },
    onError: (error) => {
      console.error(error);
    },
  }));

  const skipUpdate = async () => {
    await askForMicrophonePermission();
    navigate({ to: "/create-lobby" });
  };

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
          <div class="flex flex-grow items-center justify-center">
            <IconLoaderCircle class="animate-spin text-6xl" />
          </div>
        </Match>

        <Match when={installUpdateMutation.isPending}>
          <div class="flex flex-grow items-center justify-center">
            <IconLoaderCircle class="animate-spin text-6xl" />
            <div class="ml-4 text-xl">{t("update.installing")}</div>
          </div>
        </Match>

        <Match when={checkUpdateQuery.isError}>
          <div class="flex w-full flex-grow flex-col justify-center">
            <h1 class="mb-[10cqh] text-center font-bold text-4xl">{t("update.checkFailed")}</h1>
            <Menu items={errorMenuItems} gradient="gradient-settings" class="h-min grow-0" />
          </div>
        </Match>

        <Match when={installUpdateMutation.isError}>
          <div class="flex w-full flex-grow flex-col justify-center">
            <h1 class="mb-[10cqh] text-center font-bold text-4xl">{t("update.installFailed")}</h1>
            <Menu items={errorMenuItems} gradient="gradient-settings" class="h-min grow-0" />
          </div>
        </Match>

        <Match when={checkUpdateQuery.isSuccess && checkUpdateQuery.data}>
          {(update) => (
            <div class="flex w-full flex-grow flex-col justify-center">
              <h1 class="mb-4 text-center font-bold text-4xl">{t("update.available")}</h1>
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
