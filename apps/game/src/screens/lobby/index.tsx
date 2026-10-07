import { useQuery } from "@tanstack/solid-query";
import { useNavigate } from "@tanstack/solid-router";
import { createMemo, Show } from "solid-js";
import IconRefreshCw from "~icons/ph/arrows-clockwise-bold";
import IconClub from "~icons/ph/flag-banner-fill";

import JoinPanel from "~/components/join-panel";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import TitleBar from "~/components/title-bar";
import Avatar from "~/components/ui/avatar";
import CardGrid, { type GridCard } from "~/components/ui/card-grid";
import { t } from "~/lib/i18n";
import { availableClubsQueryOptions, lobbyQueryOptions } from "~/lib/queries";
import { lobbyStore } from "~/stores/lobby";

export default function LobbyScreen() {
  const navigate = useNavigate();
  const onBack = () => navigate({ to: "/home" });

  const lobbyQuery = useQuery(() => lobbyQueryOptions());
  const availableClubsQuery = useQuery(() => availableClubsQueryOptions());

  const recreateLobby = () => {
    lobbyStore.clearLobby();
    navigate({ to: "/create-lobby" });
  };

  const cards = createMemo((): GridCard[] => {
    const cards: GridCard[] = [];

    for (const user of lobbyQuery.data?.users ?? []) {
      cards.push({
        id: `online-${user.id}`,
        label: user.username ?? t("lobby.unknownPlayer"),
        subtitle: lobbyStore.remoteControlIds().includes(user.id) ? t("lobby.remoteControl") : t("lobby.online"),
        visual: <Avatar user={user} class="size-[6cqw] text-[2.5cqw]" />,
        accent: "yellow",
        action: () => navigate({ to: "/lobby/$id", params: { id: user.id } }),
      });
    }

    for (const player of lobbyStore.localPlayersInLobby()) {
      cards.push({
        id: `local-${player.id}`,
        label: player.username,
        subtitle: t("lobby.local"),
        visual: <Avatar user={player} class="size-[6cqw] text-[2.5cqw]" />,
        accent: "orange",
        action: () => navigate({ to: "/lobby/local/$id", params: { id: player.id } }),
      });
    }

    cards.push({
      id: "add",
      label: t("lobby.addLocalPlayer"),
      add: true,
      action: () => navigate({ to: "/lobby/add-local-player" }),
    });

    if ((availableClubsQuery.data ?? []).length > 0) {
      cards.push({
        id: "club",
        label: lobbyQuery.data?.selectedClub?.name ?? t("lobby.noClub"),
        subtitle: t("lobby.club"),
        visual: <IconClub />,
        action: () => navigate({ to: "/lobby/select-club" }),
      });
    }

    if (lobbyStore.lobby()) {
      cards.push({
        id: "recreate",
        label: t("lobby.recreateLobby"),
        visual: <IconRefreshCw />,
        action: recreateLobby,
      });
    }

    return cards;
  });

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title={t("lobby.title")} onBack={onBack} />}
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <div class="flex h-full min-h-0 items-center gap-[3cqw]">
        <div class="flex h-full min-w-0 grow items-center">
          <CardGrid cards={cards()} onBack={onBack} columns={4} gradient="gradient-lobby" />
        </div>
        <Show when={lobbyStore.lobby()}>
          {(lobby) => <JoinPanel code={lobby().lobby.id} vertical class="w-[22cqw] shrink-0" />}
        </Show>
      </div>
    </Layout>
  );
}
