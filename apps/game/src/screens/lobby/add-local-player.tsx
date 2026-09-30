import { useNavigate } from "@tanstack/solid-router";
import { createMemo } from "solid-js";

import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import TitleBar from "~/components/title-bar";
import Avatar from "~/components/ui/avatar";
import CardGrid, { type GridCard } from "~/components/ui/card-grid";
import { t } from "~/lib/i18n";
import { playSound } from "~/lib/sound";
import { lobbyStore } from "~/stores/lobby";
import { localStore } from "~/stores/local";

export default function AddLocalPlayerScreen() {
  const navigate = useNavigate();
  const onBack = () => {
    playSound("confirm");
    navigate({ to: "/lobby" });
  };

  const cards = createMemo((): GridCard[] => {
    const alreadyInLobby = lobbyStore.localPlayersInLobby();
    return localStore
      .players()
      .filter((player) => !alreadyInLobby.some((p) => p.id === player.id))
      .map((player) => ({
        id: player.id,
        label: player.username,
        visual: <Avatar user={player} class="size-[6cqw] text-[2.5cqw]" />,
        accent: "orange",
        action: () => {
          lobbyStore.addLocalPlayer(player.id);
          navigate({ to: "/lobby" });
        },
      }));
  });

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title={t("lobby.addLocalPlayer")} onBack={onBack} />}
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <div class="flex h-full items-center">
        <CardGrid cards={cards()} onBack={onBack} gradient="gradient-lobby" />
      </div>
    </Layout>
  );
}
