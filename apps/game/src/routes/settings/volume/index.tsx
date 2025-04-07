import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createSignal } from "solid-js";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import TitleBar from "~/components/title-bar";
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
      label: "Master Volume",
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
      label: "Game Volume",
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
      label: "Preview Volume",
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
      label: "Menu Volume",
      value: () => Math.round(volume().menu * 100),
      min: 0,
      max: 100,
      step: 1,
      onInput: (value: number) => {
        setVolume((prev) => ({ ...prev, menu: Math.round(value) / 100 }));
      },
    },
    {
      type: "button",
      label: "Save",
      action: saveVolume,
    },
  ];

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title="Settings" description="Volume" onBack={onBack} />}
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <Menu items={menuItems} onBack={onBack} />
    </Layout>
  );
}
