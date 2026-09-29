import { useNavigate } from "@tanstack/solid-router";
import { createMemo } from "solid-js";

import Layout from "~/components/layout";
import SettingsFooter from "~/components/settings-footer";
import TitleBar from "~/components/title-bar";
import Avatar from "~/components/ui/avatar";
import CardGrid, { type GridCard } from "~/components/ui/card-grid";
import { t } from "~/lib/i18n";
import { playSound } from "~/lib/sound";
import { localStore } from "~/stores/local";

export default function LocalPlayersScreen() {
  const navigate = useNavigate();
  const onBack = () => {
    playSound("confirm");
    navigate({ to: "/settings" });
  };

  const cards = createMemo((): GridCard[] => [
    ...localStore.players().map((player) => ({
      id: player.id,
      label: player.username,
      visual: <Avatar user={player} class="size-[6cqw] text-[2.5cqw] ring-[0.25cqw] ring-white" />,
      action: () => navigate({ to: "/settings/local-players/$id", params: { id: player.id } }),
    })),
    {
      id: "new",
      label: t("settings.add"),
      add: true,
      action: () => navigate({ to: "/settings/local-players/$id", params: { id: "new" } }),
    },
  ]);

  return (
    <Layout
      intent="secondary"
      header={
        <TitleBar title={t("settings.title")} description={t("settings.sections.localPlayers.title")} onBack={onBack} />
      }
      footer={<SettingsFooter />}
    >
      <div class="flex h-full items-center">
        <CardGrid cards={cards()} onBack={onBack} />
      </div>
    </Layout>
  );
}
