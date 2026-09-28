import { createFileRoute, useNavigate } from "@tanstack/solid-router";

import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import SettingsFooter from "~/components/settings-footer";
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
      // Opens in the browser; the app window never navigates away.
      action: () => window.open("https://ultrastar-play.com"),
    },
    {
      type: "button",
      label: "Karol Szcześniak",
    },
  ];

  return (
    <Layout intent="secondary" header={<TitleBar title="Credits" onBack={onBack} />} footer={<SettingsFooter />}>
      <Menu items={menuItems} onBack={onBack} />
    </Layout>
  );
}
