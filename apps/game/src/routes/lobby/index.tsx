import { useQuery } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import type { Accessor } from "solid-js";
import { createMemo } from "solid-js";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import type { MenuItem } from "~/components/menu";
import Menu from "~/components/menu";
import TitleBar from "~/components/title-bar";
import Avatar from "~/components/ui/avatar";
import { lobbyQueryOptions } from "~/lib/queries";
import { lobbyStore } from "~/stores/lobby";
import IconHome from "~icons/lucide/home";

export const Route = createFileRoute("/lobby/")({
  component: LobbyComponent,
});

function LobbyComponent() {
  const navigate = useNavigate();
  const onBack = () => navigate({ to: "/home" });

  const lobbyQuery = useQuery(() => lobbyQueryOptions());

  const menuItems: Accessor<MenuItem[]> = createMemo(() => {
    const items: MenuItem[] = [];

    const onlineUsers = lobbyQuery.data?.users || [];
    for (const user of onlineUsers) {
      items.push({
        type: "button",
        label: (
          <div class="flex items-center gap-3">
            <Avatar user={user} />
            <span>{user.username ?? "?"}</span>
          </div>
        ),
        action: () => navigate({ to: "/lobby/$id", params: { id: user.id } }),
      });
    }

    const localPlayers = lobbyStore.localPlayersInLobby();

    for (const player of localPlayers) {
      if (player.type === "guest") continue;

      items.push({
        type: "button",
        label: (
          <div class="flex items-center gap-2">
            <span>{player.username}</span>
            <IconHome class="h-4 w-4" />
          </div>
        ),
        action: () => navigate({ to: "/lobby/local/$id", params: { id: player.id } }),
      });
    }

    items.push({
      type: "button",
      label: "Add Local Player",
      action: () => navigate({ to: "/lobby/add-local-player" }),
    });

    return items;
  });

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title="Lobby" onBack={onBack} />}
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <Menu items={menuItems()} onBack={onBack} gradient="gradient-lobby" />
    </Layout>
  );
}
