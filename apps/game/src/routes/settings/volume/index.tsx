import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createSignal } from "solid-js";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";
import { settingsStore } from "~/stores/settings";

export const Route = createFileRoute("/settings/volume/")({
  component: VolumeComponent,
});

function VolumeComponent() {
  const navigate = useNavigate();
  const onBack = () => {
    navigate({ to: "/settings" });
  };

  const [volume, setVolume] = createSignal(settingsStore.volume());

  const saveVolume = () => {
    settingsStore.saveVolume(volume());
    onBack();
  };

  const menuItems: MenuItem[] = [
    {
      type: "slider",
      label: t("settings.sections.volume.master"),
      value: () => Math.round(volume().master * 100),
      min: 0,
      max: 100,
      step: 1,
      onInput: (value: number) => {
        setVolume((prev) => ({ ...prev, master: Math.round(value) / 100 }));
      },
    },
    {
      type: "slider",
      label: t("settings.sections.volume.game"),
      value: () => Math.round(volume().game * 100),
      min: 0,
      max: 100,
      step: 1,
      onInput: (value: number) => {
        setVolume((prev) => ({ ...prev, game: Math.round(value) / 100 }));
      },
    },
    {
      type: "slider",
      label: t("settings.sections.volume.preview"),
      value: () => Math.round(volume().preview * 100),
      min: 0,
      max: 100,
      step: 1,
      onInput: (value: number) => {
        setVolume((prev) => ({ ...prev, preview: Math.round(value) / 100 }));
      },
    },
    {
      type: "slider",
      label: t("settings.sections.volume.menu"),
      value: () => Math.round(volume().menu * 100),
      min: 0,
      max: 100,
      step: 1,
      onInput: (value: number) => {
        setVolume((prev) => ({ ...prev, menu: Math.round(value) / 100 }));
      },
    },
    {
      type: "slider",
      label: t("settings.sections.volume.micPlaybackVolume"),
      value: () => Math.round(volume().micPlayback * 100),
      min: 0,
      max: 100,
      step: 1,
      onInput: (value: number) => {
        setVolume((prev) => ({ ...prev, micPlayback: Math.round(value) / 100 }));
      },
    },
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
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <Menu items={menuItems} onBack={onBack} />
    </Layout>
  );
}
