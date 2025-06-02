import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import type { Accessor } from "solid-js";
import { createMemo } from "solid-js";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import type { MenuItem } from "~/components/menu";
import Menu from "~/components/menu";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";
import { playSound } from "~/lib/sound";
import { lobbyStore } from "~/stores/lobby";
import { localStore } from "~/stores/local";

export const Route = createFileRoute("/lobby/add-local-player")({
  component: AddLocalPlayerComponent,
});

function AddLocalPlayerComponent() {
  const navigate = useNavigate();
  const onBack = () => {
    playSound("confirm");
    navigate({ to: "/lobby" });
  };

  const menuItems: Accessor<MenuItem[]> = createMemo(() => {
    const allLocalPlayers = localStore.players();
    const alreadyInLobby = lobbyStore.localPlayersInLobby();

    return allLocalPlayers
      .filter((player) => !alreadyInLobby.some((p) => p.id === player.id))
      .map((player) => ({
        type: "button" as const,
        label: player.username,
        action: () => {
          playSound("confirm");
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
      <Menu items={menuItems()} onBack={onBack} gradient="gradient-lobby" />
    </Layout>
  );
}
