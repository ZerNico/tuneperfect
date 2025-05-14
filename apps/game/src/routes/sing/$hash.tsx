import { createQuery } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { type Accessor, createSignal } from "solid-js";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import TitleBar from "~/components/title-bar";
import Avatar from "~/components/ui/avatar";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import type { LocalUser } from "~/lib/types";
import { useRoundStore } from "~/stores/round";
import { settingsStore } from "~/stores/settings";
import { songsStore } from "~/stores/songs";

export const Route = createFileRoute("/sing/$hash")({
  component: PlayerSelectionComponent,
});

const localUsers: LocalUser[] = [
  {
    id: "guest",
    username: t("common.players.guest"),
    image: null,
    type: "local",
  },
];

function PlayerSelectionComponent() {
  const params = Route.useParams();

  const song = () => songsStore.songs().find((song) => song.hash === params().hash);
  const voiceCount = () => song()?.voices.length || 0;

  const navigate = useNavigate();
  const onBack = () => navigate({ to: "/sing" });
  const roundStore = useRoundStore();
  const lobbyQuery = createQuery(() => client.lobby.currentLobby.queryOptions());
  const [playerCount, setPlayerCount] = createSignal(settingsStore.microphones().length);
  const [selectedPlayers, setSelectedPlayers] = createSignal<(number | string)[]>(
    Array(settingsStore.microphones().length).fill(localUsers[0]?.id || -1)
  );
  const [selectedVoices, setSelectedVoices] = createSignal<number[]>(
    Array(settingsStore.microphones().length)
      .fill(0)
      .map((_, i) => i % voiceCount())
  );

  const users = () => [...(lobbyQuery.data?.users || []), ...localUsers];

  const startGame = () => {
    const players = selectedPlayers()
      .slice(0, playerCount())
      .map((player) => users().find((user) => user.id === player) || undefined);

    const voices = selectedVoices()
      .slice(0, playerCount())
      .map((voice) => voice % voiceCount());

    const s = song();
    if (!s) {
      return;
    }

    roundStore.startRound({ song: s, players, voices });
  };

  const setPlayer = (playerNumber: number, value: number | string) => {
    setSelectedPlayers((prev) => [...prev.slice(0, playerNumber), value, ...prev.slice(playerNumber + 1)]);
  };

  const setVoice = (playerNumber: number, value: number) => {
    setSelectedVoices((prev) => [...prev.slice(0, playerNumber), value, ...prev.slice(playerNumber + 1)]);
  };

  const menuItems: Accessor<MenuItem[]> = () => {
    const inputs: MenuItem[] = [
      {
        type: "select-number",
        label: t("sing.players"),
        value: playerCount,
        onChange: setPlayerCount,
        options: Array.from({ length: settingsStore.microphones().length }, (_, i) => i + 1),
      },
    ];

    for (const playerIndex of Array.from({ length: playerCount() }, (_, i) => i)) {
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

      if (voiceCount() > 1) {
        inputs.push({
          type: "select-number",
          label: `${t("sing.voice")} ${playerIndex + 1}`,
          value: () => selectedVoices()[playerIndex] || 0,
          options: Array.from({ length: voiceCount() }, (_, i) => i),
          onChange: (value) => setVoice(playerIndex, value),
          renderValue: (value) => {
            const s = song();
            if (!s || value === null) {
              return value;
            }
            const duetSingerKey = `duetSingerP${value + 1}` as "p1" | "p2";
            if (duetSingerKey in s) {
              const duetSinger = s[duetSingerKey];
              return <span>{duetSinger}</span>;
            }

            return <span>{value}</span>;
          },
        });
      }
    }

    inputs.push({
      type: "button",
      label: t("sing.start"),
      action: startGame,
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
