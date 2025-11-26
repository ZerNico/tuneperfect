import { useQuery } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { type Accessor, createEffect, createSignal } from "solid-js";
import * as v from "valibot";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import TitleBar from "~/components/title-bar";
import Avatar from "~/components/ui/avatar";
import { t } from "~/lib/i18n";
import { lobbyQueryOptions } from "~/lib/queries";
import { guestUser, lobbyStore } from "~/stores/lobby";
import { useRoundActions } from "~/stores/round";
import { settingsStore } from "~/stores/settings";
import { songsStore } from "~/stores/songs";

export const Route = createFileRoute("/sing/medley")({
  component: RouteComponent,
  validateSearch: v.object({
    songs: v.array(v.string()),
  }),
});

const [selectedPlayers, setSelectedPlayers] = createSignal<(number | string)[]>(
  Array(settingsStore.microphones().length).fill("guest"),
);

function RouteComponent() {
  const search = Route.useSearch();
  const roundActions = useRoundActions();

  const medleySongs = () => {
    const songHashes = search().songs;
    return songHashes
      .map((hash) => songsStore.songs().find((song) => song.hash === hash))
      .filter((song): song is NonNullable<typeof song> => song !== undefined);
  };

  const navigate = useNavigate();
  const onBack = () => navigate({ to: "/sing" });
  const lobbyQuery = useQuery(() => lobbyQueryOptions());

  const users = () => [...lobbyStore.localPlayersInLobby(), ...(lobbyQuery.data?.users || []), guestUser];

  createEffect(() => {
    const availableUsers = users();
    const currentSelected = selectedPlayers();

    const updatedSelected = currentSelected.map((selected) => {
      if (selected === "guest") return selected;
      if (availableUsers.find((user) => user.id === selected)) return selected;
      return "guest";
    });

    if (updatedSelected.some((val, i) => val !== currentSelected[i])) {
      setSelectedPlayers(updatedSelected);
    }
  });

  createEffect(() => {
    const micCount = settingsStore.microphones().length;
    const currentSelected = selectedPlayers();

    if (currentSelected.length !== micCount) {
      if (currentSelected.length < micCount) {
        setSelectedPlayers([...currentSelected, ...Array(micCount - currentSelected.length).fill("guest")]);
      } else {
        setSelectedPlayers(currentSelected.slice(0, micCount));
      }
    }
  });

  const startMedley = () => {
    const songs = medleySongs();
    if (songs.length === 0) {
      return;
    }

    const players = selectedPlayers()
      .slice(0, settingsStore.microphones().length)
      .map((player) => users().find((user) => user.id === player) || undefined);

    const roundSongs = songs.map((song) => {
      const voiceCount = song.voices.length;

      const voices = players.map((_, playerIndex) => playerIndex % voiceCount);
      return {
        song,
        voice: voices,
        players,
      };
    });

    roundActions.startRound({ songs: roundSongs.map((song) => ({ ...song, mode: "medley" })) });
  };

  const setPlayer = (playerNumber: number, value: number | string) => {
    setSelectedPlayers((prev) => [...prev.slice(0, playerNumber), value, ...prev.slice(playerNumber + 1)]);
  };

  const menuItems: Accessor<MenuItem[]> = () => {
    const inputs: MenuItem[] = [];

    for (const playerIndex of Array.from({ length: settingsStore.microphones().length }, (_, i) => i)) {
      inputs.push({
        type: "select-string-number",
        label: `${t("sing.player")} ${playerIndex + 1}`,
        value: () => selectedPlayers()[playerIndex] || null,
        onChange: (value) => setPlayer(playerIndex, value),
        options: users().map((user) => user.id),
        renderValue: (value) => {
          const player = users().find((user) => user.id === value) || { username: "?" };
          return (
            <div class="flex items-center gap-4">
              <Avatar user={player} />
              <span>{player.username}</span>
            </div>
          );
        },
      });
    }

    inputs.push({
      type: "button",
      label: t("sing.start"),
      action: startMedley,
    });

    return inputs;
  };

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title={t("sing.players")} onBack={onBack} />}
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <Menu items={menuItems()} onBack={onBack} gradient="gradient-sing" />
    </Layout>
  );
}
