import { useQuery } from "@tanstack/solid-query";
import { useNavigate } from "@tanstack/solid-router";
import { createSignal, untrack } from "solid-js";

import Layout from "~/components/layout";
import type { MenuItem } from "~/components/menu";
import Menu from "~/components/menu";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";
import { partyUsers, validatePartyStart } from "~/lib/party/common";
import { lobbyQueryOptions } from "~/lib/queries";
import { type Settings, versusStore } from "~/stores/party/versus";

export default function VersusSettingsScreen() {
  const navigate = useNavigate();
  const onBack = () => navigate({ to: "/party" });

  const lobbyQuery = useQuery(() => lobbyQueryOptions());

  // Restarting keeps the options of the game being replaced.
  const [settings, setSettings] = createSignal<Settings>(untrack(() => versusStore.settings()) ?? { jokers: 5 });

  const startRound = () => {
    const users = partyUsers(lobbyQuery.data?.users);
    if (!validatePartyStart(users, "versus")) return;

    versusStore.startRound(settings(), users);
    navigate({ to: "/party/versus" });
  };

  const baseMenuItems: MenuItem[] = [
    {
      type: "slider",
      label: t("party.versus.jokers"),
      value: () => settings().jokers,
      onInput: (value) => setSettings((prev) => ({ ...prev, jokers: value })),
      min: 1,
      max: 15,
      step: 1,
    },
  ];

  // Decided once on entry: starting sets `playing`, which would otherwise swap the menu
  // to Restart/Continue while this page is still transitioning out.
  const resuming = untrack(() => versusStore.state().playing);

  const menuItems = (): MenuItem[] => {
    if (resuming) {
      return [
        ...baseMenuItems,
        {
          type: "button",
          label: t("party.versus.restart"),
          action: () => {
            startRound();
          },
        },
        {
          type: "button",
          label: t("party.versus.continue"),
          action: () => {
            navigate({ to: "/party/versus" });
          },
        },
      ];
    }

    return [
      ...baseMenuItems,
      {
        type: "button",
        label: t("party.versus.start"),
        action: () => {
          startRound();
        },
      },
    ];
  };

  return (
    <Layout intent="secondary" header={<TitleBar title={t("party.versus.title")} onBack={onBack} />}>
      <Menu items={menuItems()} onBack={onBack} gradient="gradient-party" />
    </Layout>
  );
}
