import { useNavigate } from "@tanstack/solid-router";
import { createMemo } from "solid-js";
import IconMicVocal from "~icons/ph/microphone-stage-fill";

import Layout from "~/components/layout";
import SettingsFooter from "~/components/settings-footer";
import TitleBar from "~/components/title-bar";
import CardGrid, { type GridCard } from "~/components/ui/card-grid";
import { t } from "~/lib/i18n";
import { playSound } from "~/lib/sound";
import { settingsStore } from "~/stores/settings";

const MAX_MICROPHONES = 4;

export default function MicrophonesScreen() {
  const navigate = useNavigate();
  const onBack = () => {
    playSound("confirm");
    navigate({ to: "/settings" });
  };

  const cards = createMemo(() => {
    const microphones = settingsStore.microphones();
    const cards: GridCard[] = microphones.map((microphone, index) => ({
      id: String(index),
      label: microphone.name,
      subtitle: `${t("settings.sections.microphones.channel")} ${microphone.channel + 1}`,
      visual: <IconMicVocal />,
      accent: microphone.color,
      action: () => navigate({ to: "/settings/microphones/$id", params: { id: index.toString() } }),
    }));

    if (microphones.length < MAX_MICROPHONES) {
      cards.push({
        id: "add",
        label: t("settings.add"),
        add: true,
        action: () => navigate({ to: "/settings/microphones/$id", params: { id: microphones.length.toString() } }),
      });
    }

    return cards;
  });

  return (
    <Layout
      intent="secondary"
      header={
        <TitleBar title={t("settings.title")} description={t("settings.sections.microphones.title")} onBack={onBack} />
      }
      footer={<SettingsFooter />}
    >
      <div class="flex h-full items-center">
        <CardGrid cards={cards()} onBack={onBack} />
      </div>
    </Layout>
  );
}
