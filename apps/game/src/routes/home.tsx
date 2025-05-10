import { useQuery } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { type Component, For, Show, createEffect, createSignal, on } from "solid-js";
import { Dynamic } from "solid-js/web";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Avatar from "~/components/ui/avatar";
import { createLoop } from "~/hooks/loop";
import { useNavigation } from "~/hooks/navigation";
import { createQRCode } from "~/hooks/qrcode";
import { client } from "~/lib/orpc";
import { playSound } from "~/lib/sound";
import { lobbyStore } from "~/stores/lobby";
import IconMicVocal from "~icons/lucide/mic-vocal";
import IconPartyPopper from "~icons/lucide/party-popper";
import IconSettings from "~icons/lucide/settings";
import IconUsers from "~icons/lucide/users";

export const Route = createFileRoute("/home")({
  component: HomeComponent,
});

function HomeComponent() {
  const navigate = useNavigate();
  const [pressed, setPressed] = createSignal(false);

  const cards = [
    {
      label: "Sing",
      gradient: "gradient-sing",
      icon: IconMicVocal,
      description: "Sing your favorite songs, alone or with your friends!",
      action: () => navigate({ to: "/sing" }),
    },
    {
      label: "Party",
      gradient: "gradient-party",
      icon: IconPartyPopper,
      description: "Battle it out with your friends in one of the different party game modes!",
    },
    {
      label: "Lobby",
      gradient: "gradient-lobby",
      icon: IconUsers,
      description: "Manage the party you are in and invite your friends.",
      action: () => navigate({ to: "/lobby" }),
    },
    {
      label: "Settings",
      gradient: "gradient-settings",
      icon: IconSettings,
      description: "Change your settings or add your songs and microphones.",
      action: () => navigate({ to: "/settings" }),
    },
  ];

  const { position, increment, decrement, set } = createLoop(4);

  useNavigation(() => ({
    layer: 0,
    onKeydown(event) {
      if (event.action === "left") {
        decrement();
        playSound("select");
      } else if (event.action === "right") {
        increment();
        playSound("select");
      } else if (event.action === "confirm") {
        setPressed(true);
        playSound("confirm");
      }
    },
    onKeyup(event) {
      if (event.action === "confirm") {
        setPressed(false);
        const card = cards[position()];
        card?.action?.();
      }
    },
  }));

  const qrcode = createQRCode(() => `${import.meta.env.VITE_APP_URL}/join/${lobbyStore.lobby()?.lobby.id}`, {
    type: "image/webp",
    width: 1024,
  });

  const lobbyQuery = useQuery(() => client.lobby.currentLobby.queryOptions());

  createEffect(on(position, () => playSound("select"), { defer: true }));

  return (
    <Layout
      header={
        <div class="flex justify-between">
          <div />
          <div class="flex gap-2">
            <For each={lobbyQuery.data?.users}>{(user) => <Avatar user={user} />}</For>
          </div>
        </div>
      }
      footer={<KeyHints hints={["navigate", "confirm"]} />}
    >
      <div class="flex flex-grow flex-col gap-[6cqh]">
        <div class="flex flex-grow">
          <div class="flex-grow" />
          <Show when={lobbyStore.lobby()}>
            {(lobby) => (
              <div class="flex items-end">
                <div class="flex gap-8">
                  <div class="flex flex-col items-end justify-center">
                    <span class="font-bold text-7xl">{lobby().lobby.id}</span>
                    <span class="text-sm">{import.meta.env.VITE_APP_URL}/join</span>
                  </div>
                  <Show when={qrcode()}>{(qrcode) => <img src={qrcode()} alt="" class="h-[25cqh] rounded-lg" />}</Show>
                </div>
              </div>
            )}
          </Show>
        </div>
        <div class="flex gap-4">
          <For each={cards}>
            {(card, index) => (
              <ModeCard
                selected={position() === index()}
                active={pressed() && position() === index()}
                class="flex-1"
                label={card.label}
                gradient={card.gradient}
                icon={card.icon}
                description={card.description}
                onMouseEnter={() => set(index())}
                onClick={card.action}
              />
            )}
          </For>
        </div>
      </div>
    </Layout>
  );
}

interface ModeCardProps {
  selected?: boolean;
  active?: boolean;
  label: string;
  class?: string;
  gradient?: string;
  icon?: Component<{ class?: string }>;
  description?: string;
  onMouseEnter?: () => void;
  onClick?: () => void;
}
function ModeCard(props: ModeCardProps) {
  return (
    <button
      class="flex transform flex-col gap-1 p-1 transition-all ease-in-out active:scale-95"
      type="button"
      classList={{
        [props.class || ""]: true,
        "opacity-50": !props.selected,
        "scale-95": props.active,
      }}
      onMouseEnter={props.onMouseEnter}
      onClick={props.onClick}
    >
      <div class="font-semibold text-sm uppercase">{props.label}</div>
      <div
        class="flex w-full flex-grow flex-col shadow-xl"
        classList={{
          "overflow-hidden rounded-lg": props.selected,
        }}
      >
        <div
          class="flex items-center justify-center rounded-t-lg bg-gradient-to-b px-12 py-16 transition-all"
          classList={{
            [props.gradient || ""]: true,
            "rounded-b-lg": !props.selected,
          }}
        >
          <Dynamic class="text-6xl" component={props.icon} />
        </div>
        <div
          class="flex-grow rounded-b-md bg-white px-8 py-4 text-left font-semibold text-base text-black transition-all"
          classList={{
            "opacity-0": !props.selected,
          }}
        >
          {props.description}
        </div>
      </div>
    </button>
  );
}
