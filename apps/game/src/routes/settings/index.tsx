import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { getMatches } from "@tauri-apps/plugin-cli";
import { createMemo } from "solid-js";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";
import { tryCatch } from "~/lib/utils/try-catch";

export const Route = createFileRoute("/settings/")({
  component: SettingsComponent,
  loader: async () => {
    const [_error, matches] = await tryCatch(getMatches());
    if (matches?.args.songpath && Array.isArray(matches.args.songpath.value)) {
      return {
        songpaths: matches.args.songpath.value,
      };
    }
    return {
      songpaths: [],
    };
  },
});

function SettingsComponent() {
  const navigate = useNavigate();
  const onBack = () => navigate({ to: "/home" });
  const songpaths = Route.useLoaderData();

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
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <Menu items={menuItems()} onBack={onBack} />
    </Layout>
  );
}
