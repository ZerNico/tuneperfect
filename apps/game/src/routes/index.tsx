import { createMutation } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { Match, Switch, onMount } from "solid-js";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import type { MenuItem } from "~/components/menu";
import Menu from "~/components/menu";
import { client } from "~/lib/orpc";
import { queryClient } from "~/main";
import { lobbyStore } from "~/stores/lobby";
import IconLoaderCircle from "~icons/lucide/loader-circle";

export const Route = createFileRoute("/")({
  component: IndexComponent,
});

function IndexComponent() {
  const navigate = useNavigate();

  const createLobbyMutation = createMutation(() =>
    client.lobby.createLobby.mutationOptions({
      onSuccess: (data) => {
        lobbyStore.setLobby({ token: data.token, lobby: { id: data.lobbyId } });
        goToLoading();
      },
    })
  );

  const goToLoading = () => navigate({ to: "/loading", search: { redirect: "/home" } });

  onMount(async () => {
    if (lobbyStore.lobby()) {
      try {
        await queryClient.fetchQuery(client.lobby.currentLobby.queryOptions());
        goToLoading();
      } catch (error) {
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
      label: "Retry",
      action: () => createLobbyMutation.mutate({}),
    },
    {
      type: "button",
      label: "Play Offline",
      action: goToLoading,
    },
  ];

  return (
    <Layout intent="primary" footer={<KeyHints hints={["navigate", "confirm"]} />}>
      <Switch>
        <Match when={createLobbyMutation.isPending}>
          <div class="flex flex-grow items-center justify-center">
            <IconLoaderCircle class="animate-spin text-6xl" />
          </div>
        </Match>
        <Match when={createLobbyMutation.isError}>
          <div class="flex w-full flex-grow flex-col justify-center">
            <h1 class="mb-[10cqh] text-center font-bold text-4xl">Failed to create lobby</h1>
            <Menu items={menuItems} gradient="gradient-settings" class="h-min grow-0" />
          </div>
        </Match>
      </Switch>
    </Layout>
  );
}
