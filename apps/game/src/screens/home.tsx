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

const MAX_LOBBY_AVATARS = 6;

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
          <h1 class="text-5xl font-black tracking-tight">Tune Perfect</h1>
          <Show when={(lobbyQuery.data?.users.length ?? 0) > 0}>
            {/* Just the faces of who's in the lobby; the join code below says what it is. */}
            <div class="flex -space-x-2.5">
              <For each={lobbyQuery.data?.users.slice(0, MAX_LOBBY_AVATARS)}>
                {(user) => <Avatar user={user} class="size-10 ring-2 ring-black/40" />}
              </For>
              <Show when={(lobbyQuery.data?.users.length ?? 0) > MAX_LOBBY_AVATARS}>
                <div class="flex size-10 items-center justify-center rounded-full bg-white/15 text-sm font-bold tabular-nums ring-2 ring-black/40 backdrop-blur-sm">
                  +{(lobbyQuery.data?.users.length ?? 0) - MAX_LOBBY_AVATARS}
                </div>
              </Show>
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
