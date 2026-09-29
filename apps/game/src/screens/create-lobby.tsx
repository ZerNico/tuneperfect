import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { useNavigate } from "@tanstack/solid-router";
import { differenceInDays } from "date-fns";
import { Match, onMount, Switch } from "solid-js";

import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import LoadingPanel from "~/components/loading-panel";
import type { MenuItem } from "~/components/menu";
import Menu from "~/components/menu";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { lobbyStore } from "~/stores/lobby";
import { settingsStore } from "~/stores/settings";

export default function IndexScreen() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const createLobbyMutation = useMutation(() =>
    client.lobby.createLobby.mutationOptions({
      onSuccess: (data) => {
        lobbyStore.setLobby({ token: data.token, lobby: { id: data.lobbyId }, createdAt: Date.now() });
        goToLoading();
      },
    }),
  );

  const goToLoading = () => navigate({ to: "/loading", search: { redirect: "/home" } });

  onMount(async () => {
    if (settingsStore.general().forceOfflineMode) {
      lobbyStore.clearLobby();
      goToLoading();
      return;
    }

    const currentLobby = lobbyStore.lobby();
    if (currentLobby) {
      const isLobbyOlderThanOneDay = differenceInDays(Date.now(), currentLobby.createdAt) >= 1;

      if (isLobbyOlderThanOneDay) {
        lobbyStore.clearLobby();
        createLobbyMutation.mutate({});
        return;
      }

      try {
        await queryClient.fetchQuery(client.lobby.currentLobby.queryOptions());
        goToLoading();
      } catch {
        lobbyStore.clearLobby();
        createLobbyMutation.mutate({});
      }
    } else {
      createLobbyMutation.mutate({});
    }
  });

  const menuItems: MenuItem[] = [
    {
      type: "button",
      label: t("createLobby.retry"),
      action: () => createLobbyMutation.mutate({}),
    },
    {
      type: "button",
      label: t("createLobby.playOffline"),
      action: goToLoading,
    },
  ];

  return (
    <Layout intent="primary" footer={<KeyHints hints={["navigate", "confirm"]} />}>
      <Switch>
        <Match when={createLobbyMutation.isPending}>
          <div class="flex grow items-center justify-center">
            <LoadingPanel title={t("lobby.title")} progress={null} detail={t("createLobby.creating")} />
          </div>
        </Match>
        <Match when={createLobbyMutation.isError}>
          <div class="flex w-full grow flex-col justify-center">
            <h1 class="mb-[10cqh] text-center text-5xl text-display">{t("createLobby.failed")}</h1>
            <Menu items={menuItems} gradient="gradient-settings" class="h-min grow-0" />
          </div>
        </Match>
      </Switch>
    </Layout>
  );
}
