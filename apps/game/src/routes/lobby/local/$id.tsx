import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import type { Accessor } from "solid-js";
import { createMemo } from "solid-js";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import type { MenuItem } from "~/components/menu";
import Menu from "~/components/menu";
import TitleBar from "~/components/title-bar";
import { playSound } from "~/lib/sound";
import { lobbyStore } from "~/stores/lobby";
import { localStore } from "~/stores/local";

export const Route = createFileRoute("/lobby/local/$id")({
  component: LobbyLocalPlayerComponent,
});

function LobbyLocalPlayerComponent() {
  const navigate = useNavigate();
  const params = Route.useParams();

  const player = createMemo(() => {
    return localStore.players().find(p => p.id === params().id);
  });

  const onBack = () => {
    playSound("confirm");
    navigate({ to: "/lobby" });
  };

  const onRemove = () => {
    playSound("confirm");
    lobbyStore.removeLocalPlayer(params().id);
    navigate({ to: "/lobby" });
  };

  const menuItems: Accessor<MenuItem[]> = createMemo(() => {
    const currentPlayer = player();
    if (!currentPlayer) return [];

    return [
      {
        type: "button" as const,
        label: "Remove from Lobby",
        action: onRemove,
      },
    ];
  });

  const currentPlayer = player();

  return (
    <Layout
      intent="secondary"
      header={
        <TitleBar 
          title={currentPlayer?.username || "Unknown Player"} 
          description="Local player in lobby" 
          onBack={onBack} 
        />
      }
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <Menu items={menuItems()} onBack={onBack} gradient="gradient-lobby" />
    </Layout>
  );
} 