import { useQuery } from "@tanstack/solid-query";
import { useNavigate } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import IconConfetti from "~icons/ph/confetti-fill";
import IconGear from "~icons/ph/gear-six-fill";
import IconMicrophone from "~icons/ph/microphone-stage-fill";
import IconUsers from "~icons/ph/users-three-fill";

import JoinPanel from "~/components/join-panel";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import ModeCardRow, { type ModeCardItem } from "~/components/mode-card-row";
import Avatar from "~/components/ui/avatar";
import { t } from "~/lib/i18n";
import { lobbyQueryOptions } from "~/lib/queries";
import { playSound } from "~/lib/sound";
import { notify } from "~/lib/toast";
import { lobbyStore } from "~/stores/lobby";
import { settingsStore } from "~/stores/settings";

export default function HomeScreen() {
  const navigate = useNavigate();
  const cards: ModeCardItem[] = [
    {
      label: t("sing.title"),
      gradient: "gradient-sing",
      icon: IconMicrophone,
      description: t("home.singDescription"),
      action: () => {
        const microphones = settingsStore.microphones();
        if (microphones.length === 0) {
          notify({
            message: t("home.microphoneRequired"),
            intent: "error",
          });
          return;
        }

        navigate({ to: "/sing" });
        playSound("confirm");
      },
    },
    {
      label: t("home.party"),
      gradient: "gradient-party",
      icon: IconConfetti,
      description: t("home.partyDescription"),
      action: () => {
        navigate({ to: "/party" });
        playSound("confirm");
      },
    },
    {
      label: t("lobby.title"),
      gradient: "gradient-lobby",
      icon: IconUsers,
      description: t("home.lobbyDescription"),
      action: () => {
        navigate({ to: "/lobby" });
        playSound("confirm");
      },
    },
    {
      label: t("settings.title"),
      gradient: "gradient-settings",
      icon: IconGear,
      description: t("home.settingsDescription"),
      action: () => {
        navigate({ to: "/settings" });
        playSound("confirm");
      },
    },
  ];

  const lobbyQuery = useQuery(() => lobbyQueryOptions());

  return (
    <Layout
      header={
        <div class="flex items-center justify-between">
          <h1 class="text-5xl text-display">Tune Perfect</h1>
          <div class="flex -space-x-2">
            <For each={lobbyQuery.data?.users}>{(user) => <Avatar user={user} class="ring-2 ring-black/40" />}</For>
          </div>
        </div>
      }
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <div class="flex h-full flex-col gap-6 pb-2">
        {/* Reserved even offline so the cards keep the same size and position. */}
        <div class="flex h-[24cqh] shrink-0 justify-end">
          <Show when={lobbyStore.lobby()}>{(lobby) => <JoinPanel code={lobby().lobby.id} />}</Show>
        </div>
        <ModeCardRow class="grow" cards={cards} onBack={() => navigate({ to: "/quit" })} />
      </div>
    </Layout>
  );
}
