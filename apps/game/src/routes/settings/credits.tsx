import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { openUrl } from '@tauri-apps/plugin-opener';
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import TitleBar from "~/components/title-bar";

export const Route = createFileRoute("/settings/credits")({
  component: CreditsComponent,
});

function CreditsComponent() {
  const navigate = useNavigate();
  const onBack = () => navigate({ to: "/settings" });

  const menuItems: MenuItem[] = [
    {
      type: "button",
      label: "UltraStar Play",
      action: () => openUrl("https://ultrastar-play.com"),
    },
    {
      type: "button",
      label: "Karol Szcześniak",
    },
  ];

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title="Credits" onBack={onBack} />}
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <Menu items={menuItems} onBack={onBack} />
    </Layout>
  );
}
