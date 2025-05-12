import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";

export const Route = createFileRoute("/settings/")({
  component: SettingsComponent,
});

function SettingsComponent() {
  const navigate = useNavigate();
  const onBack = () => navigate({ to: "/home" });

  const menuItems: MenuItem[] = [
    {
      type: "button",
      label: t("settings.sections.general.title"),
      action: () => navigate({ to: "/settings/general" }),
    },
    {
      type: "button",
      label: t("settings.sections.songs.title"),
      action: () => navigate({ to: "/settings/songs" }),
    },
    {
      type: "button",
      label: t("settings.sections.microphones.title"),
      action: () => navigate({ to: "/settings/microphones" }),
    },
    {
      type: "button",
      label: t("settings.sections.volume.title"),
      action: () => navigate({ to: "/settings/volume" }),
    },
    {
      type: "button",
      label: t("settings.sections.credits.title"),
      action: () => navigate({ to: "/settings/credits" }),
    },
  ];

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title={t("settings.title")} onBack={onBack} />}
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <Menu items={menuItems} onBack={onBack} />
    </Layout>
  );
}
