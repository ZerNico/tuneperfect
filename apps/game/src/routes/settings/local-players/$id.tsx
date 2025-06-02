import { createFileRoute, useNavigate  } from "@tanstack/solid-router";
import { createSignal } from "solid-js";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";
import { localStore } from "~/stores/local";

export const Route = createFileRoute("/settings/local-players/$id")({
  component: LocalPlayerComponent,
});

function LocalPlayerComponent() {
  const navigate = useNavigate();
  const onBack = () => {
    navigate({ to: "/settings/local-players" });
  };

  const params = Route.useParams();
  const isNew = () => params().id === "new";

  const existingPlayer = () => {
    if (isNew()) return null;
    return localStore.getPlayer(params().id);
  };

  const [playerName, setPlayerName] = createSignal(existingPlayer()?.username || "");

  const deletePlayer = () => {
    if (!isNew()) {
      localStore.deletePlayer(params().id);
    }
    onBack();
  };

  const savePlayer = () => {
    const name = playerName().trim();
    if (!name) {
      return;
    }

    if (isNew()) {
      localStore.addPlayer(name);
    } else {
      localStore.updatePlayer(params().id, { username: name });
    }
    onBack();
  };

  const menuItems: MenuItem[] = [
    {
      type: "input",
      label: t("settings.sections.localPlayers.name"),
      value: () => playerName(),
      onInput: setPlayerName,
      placeholder: t("settings.sections.localPlayers.enterName"),
    },
  ];

  if (!isNew()) {
    menuItems.push({
      type: "button",
      label: t("settings.delete"),
      action: deletePlayer,
    });
  }

  menuItems.push({
    type: "button",
    label: t("settings.save"),
    action: savePlayer,
  });

  return (
    <Layout
      intent="secondary"
      header={
        <TitleBar
          title={t("settings.title")}
          description={isNew() ? t("settings.sections.localPlayers.addNew") : t("settings.sections.localPlayers.edit")}
          onBack={onBack}
        />
      }
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <Menu items={menuItems} onBack={onBack} />
    </Layout>
  );
}
