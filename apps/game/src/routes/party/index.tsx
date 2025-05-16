import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import type { MenuItem } from "~/components/menu";
import Menu from "~/components/menu";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";
export const Route = createFileRoute("/party/")({
  component: PartyComponent,
});

function PartyComponent() {
  const navigate = useNavigate();
  const onBack = () => navigate({ to: "/home" });

  const menuItems: MenuItem[] = [
    {
      type: "button",
      label: t("party.versus.title"),
      action: () => navigate({ to: "/party/versus/settings" }),
    },
  ];
  return (
    <Layout
      intent="secondary"
      header={<TitleBar title={t("party.title")} onBack={onBack} />}
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <Menu items={menuItems} onBack={onBack} />
    </Layout>
  );
}
