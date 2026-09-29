import { useNavigate } from "@tanstack/solid-router";
import { createSignal } from "solid-js";

import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import SettingsFooter from "~/components/settings-footer";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";
import { settingsStore, type VolumeSettings } from "~/stores/settings";

export default function VolumeScreen() {
  const navigate = useNavigate();
  const onBack = () => {
    navigate({ to: "/settings" });
  };

  const [volume, setVolume] = createSignal(settingsStore.volume());

  const saveVolume = () => {
    settingsStore.saveVolume(volume());
    onBack();
  };

  const sliders: { key: keyof VolumeSettings; label: string }[] = [
    { key: "master", label: t("settings.sections.volume.master") },
    { key: "game", label: t("settings.sections.volume.game") },
    { key: "preview", label: t("settings.sections.volume.preview") },
    { key: "menu", label: t("settings.sections.volume.menu") },
    { key: "effects", label: t("settings.sections.volume.effects") },
    { key: "micPlayback", label: t("settings.sections.volume.micPlaybackVolume") },
  ];

  const menuItems: MenuItem[] = [
    ...sliders.map(({ key, label }): MenuItem => ({
      type: "slider",
      label,
      value: () => Math.round(volume()[key] * 100),
      min: 0,
      max: 100,
      step: 1,
      onInput: (value: number) => {
        setVolume((prev) => ({ ...prev, [key]: Math.round(value) / 100 }));
      },
    })),
    {
      type: "button",
      label: t("settings.save"),
      action: saveVolume,
    },
  ];

  return (
    <Layout
      intent="secondary"
      header={
        <TitleBar title={t("settings.title")} description={t("settings.sections.volume.title")} onBack={onBack} />
      }
      footer={<SettingsFooter />}
    >
      <Menu items={menuItems} onBack={onBack} />
    </Layout>
  );
}
