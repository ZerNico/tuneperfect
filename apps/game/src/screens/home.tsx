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
      },
    },
    {
      label: t("home.party"),
      gradient: "gradient-party",
      icon: IconConfetti,
      description: t("home.partyDescription"),
      action: () => {
        navigate({ to: "/party" });
      },
    },
    {
      label: t("lobby.title"),
      gradient: "gradient-lobby",
      icon: IconUsers,
      description: t("home.lobbyDescription"),
      action: () => {
        navigate({ to: "/lobby" });
      },
    },
    {
      label: t("settings.title"),
      gradient: "gradient-settings",
      icon: IconGear,
      description: t("home.settingsDescription"),
      action: () => {
        navigate({ to: "/settings" });
      },
    },
  ];

  const lobbyQuery = useQuery(() => lobbyQueryOptions());

  return (
    <Layout
      header={
        <div class="flex items-center justify-between">
          <h1 class="text-5xl font-black tracking-tight">
            Tune <span class="bg-linear-to-r from-green-300 to-cyan-300 bg-clip-text text-transparent">Perfect</span>
          </h1>
          <Show when={(lobbyQuery.data?.users.length ?? 0) > 0}>
            <div class="flex h-10 items-center gap-3 rounded-[0.9cqw] bg-black/25 pr-4 pl-1.5 text-sm font-bold ring-1 ring-white/10 ring-inset">
              <div class="flex -space-x-2">
                <For each={lobbyQuery.data?.users}>
                  {(user) => <Avatar user={user} class="size-7 ring-2 ring-black/40" />}
                </For>
              </div>
              <span>
                {t("lobby.title")} <span class="text-white/60 tabular-nums">· {lobbyQuery.data?.users.length}</span>
              </span>
            </div>
          </Show>
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
