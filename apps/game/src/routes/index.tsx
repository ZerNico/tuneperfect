import { useMutation, useQuery } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { platform } from "@tauri-apps/plugin-os";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { createEffect, Match, Switch } from "solid-js";
import IconLoaderCircle from "~icons/lucide/loader-circle";

import { commands } from "~/bindings";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import type { MenuItem } from "~/components/menu";
import Menu from "~/components/menu";
import { t } from "~/lib/i18n";
import { initializeLobbySettings } from "~/stores/lobby";
import { initializeLocalSettings } from "~/stores/local";
import { initializeSettings } from "~/stores/settings";
import { initializeUsdbStore } from "~/stores/usdb";

/** A regular update, or the move to the Electron version (see `src-tauri/src/migration.rs`). */
type AvailableUpdate = { kind: "update"; update: Update; version: string } | { kind: "migration"; version: string };

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
    queryFn: async (): Promise<AvailableUpdate | null> => {
      try {
        const migration = await commands.checkMigration();
        if (migration.status === "ok" && migration.data) {
          return { kind: "migration", version: migration.data };
        }

        const update = await check();
        return update ? { kind: "update", update, version: update.version } : null;
      } catch (error) {
        console.error("Update check failed:", error);
        throw error;
      }
    },
    retry: false,
  }));

  const askForMicrophonePermission = async () => {
    try {
      const currentPlatform = platform();
      if (currentPlatform === "macos") {
        await commands.getMicrophones();
      }
    } catch (error) {
      console.error("Failed to get microphone permissions on startup:", error);
    }
  };

  const installUpdateMutation = useMutation(() => ({
    mutationFn: async () => {
      const available = checkUpdateQuery.data;
      if (!available) return;

      if (available.kind === "migration") {
        // Starts the Electron version; only returns if something failed.
        const result = await commands.installMigration();
        if (result.status === "error") throw new Error(result.error.data);
        return;
      }

      await available.update.downloadAndInstall();
      await relaunch();
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
