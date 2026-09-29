import { useNavigate, getRouteApi } from "@tanstack/solid-router";
import { createMemo } from "solid-js";

import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import SettingsFooter from "~/components/settings-footer";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";

const route = getRouteApi("/settings/");

export default function SettingsScreen() {
  const navigate = useNavigate();
  const onBack = () => navigate({ to: "/home" });
  const songpaths = route.useLoaderData();

  const menuItems = createMemo(() => {
    const items: MenuItem[] = [
      {
        type: "button",
        label: t("settings.sections.general.title"),
        action: () => navigate({ to: "/settings/general" }),
      },
      ...(songpaths().songpaths.length === 0
        ? [
            {
              type: "button" as const,
              label: t("settings.sections.songs.title"),
              action: () => navigate({ to: "/settings/songs" }),
            },
          ]
        : []),
      {
        type: "button",
        label: t("settings.sections.microphones.title"),
        action: () => navigate({ to: "/settings/microphones" }),
      },
      {
        type: "button",
        label: t("settings.sections.localPlayers.title"),
        action: () => navigate({ to: "/settings/local-players" }),
      },
      {
        type: "button",
        label: t("settings.sections.volume.title"),
        action: () => navigate({ to: "/settings/volume" }),
      },
      {
        type: "button",
        label: t("settings.sections.usdb.title"),
        action: () => navigate({ to: "/settings/usdb" }),
      },
      {
        type: "button",
        label: t("settings.sections.credits.title"),
        action: () => navigate({ to: "/settings/credits" }),
      },
    ];
    return items;
  });

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title={t("settings.title")} onBack={onBack} />}
      footer={<SettingsFooter />}
    >
      <Menu items={menuItems()} onBack={onBack} />
    </Layout>
  );
}
