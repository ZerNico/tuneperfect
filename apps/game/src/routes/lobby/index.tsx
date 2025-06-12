import { useMutation, useQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import type { Accessor } from "solid-js";
import { createMemo } from "solid-js";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import type { MenuItem } from "~/components/menu";
import Menu from "~/components/menu";
import TitleBar from "~/components/title-bar";
import Avatar from "~/components/ui/avatar";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { availableClubsQueryOptions, lobbyQueryOptions } from "~/lib/queries";
import { lobbyStore } from "~/stores/lobby";
import IconHome from "~icons/lucide/home";
import IconRefreshCw from "~icons/lucide/refresh-cw";

export const Route = createFileRoute("/lobby/")({
  component: LobbyComponent,
});

function LobbyComponent() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const onBack = () => navigate({ to: "/home" });

  const lobbyQuery = useQuery(() => lobbyQueryOptions());
  const availableClubsQuery = useQuery(() => availableClubsQueryOptions());

  const recreateLobby = () => {
    lobbyStore.clearLobby();
    queryClient.clear();
    navigate({ to: "/create-lobby" });
  };

  const updateSelectedClubMutation = useMutation(() =>
    client.lobby.updateSelectedClub.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries(lobbyQueryOptions());
      },
    }),
  );

  const menuItems: Accessor<MenuItem[]> = createMemo(() => {
    const items: MenuItem[] = [];
    
    const clubs = availableClubsQuery.data || [];
    const selectedClub = lobbyQuery.data?.selectedClub;

    if (clubs.length > 0) {
      const noClubOption = "none";
      const clubOptions = [noClubOption, ...clubs.map((club) => club.id)];

      items.push({
        type: "select-string",
        label: t("lobby.club"),
        value: () => selectedClub?.id || noClubOption,
        onChange: (value) => {
          const clubId = value === noClubOption ? null : value;
          updateSelectedClubMutation.mutate({ clubId });
        },
        options: clubOptions,
        renderValue: (value) => {
          if (value === noClubOption || !value) {
            return <span>{t("lobby.noClub")}</span>;
          }
          const club = clubs.find((c) => c.id === value);
          return <span>{club?.name || t("lobby.noClub")}</span>;
        },
      });
    }

    // Online users
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

    // Local players
    const localPlayers = lobbyStore.localPlayersInLobby();
    for (const player of localPlayers) {
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

    // Add local player option
    items.push({
      type: "button",
      label: t("lobby.addLocalPlayer"),
      action: () => navigate({ to: "/lobby/add-local-player" }),
    });

    if (lobbyStore.lobby()) {
      items.push({
        type: "button",
        label: (
          <div class="flex items-center gap-2">
            <IconRefreshCw class="h-4 w-4" />
            <span>{t("lobby.recreateLobby")}</span>
          </div>
        ),
        action: recreateLobby,
      });
    }

    return items;
  });

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title={t("lobby.title")} onBack={onBack} />}
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <Menu items={menuItems()} onBack={onBack} gradient="gradient-lobby" />
    </Layout>
  );
}
