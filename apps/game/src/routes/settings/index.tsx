import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import TitleBar from "~/components/title-bar";

export const Route = createFileRoute("/settings/")({
  component: SettingsComponent,
});

function SettingsComponent() {
  const navigate = useNavigate();
  const onBack = () => navigate({ to: "/home" });

  const menuItems: MenuItem[] = [
    {
      type: "button",
      label: "Songs",
      action: () => navigate({ to: "/settings/songs" }),
    },
    {
      type: "button",
      label: "Microphones",
      action: () => navigate({ to: "/settings/microphones" }),
    },
    {
      type: "button",
      label: "Volume",
      action: () => navigate({ to: "/settings/volume" }),
    },
    {
      type: "button",
      label: "Credits",
      action: () => navigate({ to: "/settings/credits" }),
    },
  ];

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title="Settings" onBack={onBack} />}
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <Menu items={menuItems} onBack={onBack} />
    </Layout>
  );
}
