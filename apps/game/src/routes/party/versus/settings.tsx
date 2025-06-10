import { useQuery } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createSignal } from "solid-js";
import Layout from "~/components/layout";
import type { MenuItem } from "~/components/menu";
import Menu from "~/components/menu";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";
import { lobbyQueryOptions } from "~/lib/queries";
import { notify } from "~/lib/toast";
import { lobbyStore } from "~/stores/lobby";
import { type Settings, versusStore } from "~/stores/party/versus";
import { settingsStore } from "~/stores/settings";

export const Route = createFileRoute("/party/versus/settings")({
  component: VersusSettingsComponent,
  beforeLoad: async ({ context }) => {
    context.queryClient.prefetchQuery(lobbyQueryOptions());
  },
});

function VersusSettingsComponent() {
  const navigate = useNavigate();
  const onBack = () => navigate({ to: "/party" });

  const lobbyQuery = useQuery(() => lobbyQueryOptions());

  const [settings, setSettings] = createSignal<Settings>({
    jokers: 5,
  });

  const startRound = () => {
    const users = [...(lobbyQuery.data?.users ?? []), ...lobbyStore.localPlayersInLobby()];

    if (users.length < 2) {
      notify({
        message: t("party.versus.notEnoughPlayers"),
        intent: "error",
      });
      return;
    }

    const microphones = settingsStore.microphones();
    if (microphones.length < 2) {
      notify({
        message: t("party.versus.microphoneRequired"),
        intent: "error",
      });
      return;
    }

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

  const menuItems = (): MenuItem[] => {
    if (versusStore.state().playing) {
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
