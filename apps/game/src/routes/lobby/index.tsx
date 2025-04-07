import { createQuery } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import type { Accessor } from "solid-js";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import type { MenuItem } from "~/components/menu";
import Menu from "~/components/menu";
import TitleBar from "~/components/title-bar";
import { lobbyQueryOptions } from "~/lib/queries";

export const Route = createFileRoute("/lobby/")({
  component: LobbyComponent,
});

function LobbyComponent() {
  const navigate = useNavigate();
  const onBack = () => navigate({ to: "/home" });

  const lobbyQuery = createQuery(() => lobbyQueryOptions());

  const menuItems: Accessor<MenuItem[]> = () => {
    return (
      lobbyQuery.data?.users.map((user) => ({
        type: "button",
        label: user.username ?? "?",
        action: () => navigate({ to: "/lobby/$id", params: { id: user.id } }),
      })) ?? []
    );
  };

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
