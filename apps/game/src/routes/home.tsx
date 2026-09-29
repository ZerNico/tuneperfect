import { useQuery } from "@tanstack/solid-query";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { type Component, createEffect, createSignal, For, on, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import IconConfetti from "~icons/ph/confetti-fill";
import IconGear from "~icons/ph/gear-six-fill";
import IconMicrophone from "~icons/ph/microphone-stage-fill";
import IconUsers from "~icons/ph/users-three-fill";

import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import QRCodeView from "~/components/qr-code";
import Avatar from "~/components/ui/avatar";
import { createLoop } from "~/hooks/loop";
import { useNavigation } from "~/hooks/navigation";
import { effectsEnabled } from "~/lib/fx";
import { t } from "~/lib/i18n";
import { lobbyQueryOptions } from "~/lib/queries";
import { playSound } from "~/lib/sound";
import { notify } from "~/lib/toast";
import { lobbyStore } from "~/stores/lobby";
import { settingsStore } from "~/stores/settings";

export const Route = createFileRoute("/home")({
  component: HomeComponent,
});

function HomeComponent() {
  const navigate = useNavigate();
  const [pressed, setPressed] = createSignal(false);

  const cards = [
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

  const { position, increment, decrement, set } = createLoop(4);

  useNavigation(() => ({
    layer: 0,
    onKeydown(event) {
      if (event.action === "back") {
        navigate({ to: "/quit" });
        playSound("confirm");
      } else if (event.action === "left") {
        decrement();
      } else if (event.action === "right") {
        increment();
      } else if (event.action === "confirm") {
        setPressed(true);
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

  const lobbyQuery = useQuery(() => lobbyQueryOptions());

  createEffect(on(position, () => playSound("select"), { defer: true }));

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
        <div class="relative flex min-h-0 grow gap-5">
          <For each={cards}>
            {(card, index) => (
              <ModeCard
                selected={position() === index()}
                active={pressed() && position() === index()}
                label={card.label as string}
                gradient={card.gradient}
                icon={card.icon}
                description={card.description as string}
              />
            )}
          </For>
          {/* Fixed, equal-width hit zones: cards resize on selection, so hovering
              the cards themselves would make the selection jump under a still pointer. */}
          <div class="absolute inset-0 flex">
            <For each={cards}>
              {(card, index) => (
                <button
                  type="button"
                  class="h-full flex-1 cursor-pointer"
                  aria-label={card.label as string}
                  onMouseEnter={() => set(index())}
                  onClick={card.action}
                />
              )}
            </For>
          </div>
        </div>
      </div>
    </Layout>
  );
}

function JoinPanel(props: { code: string }) {
  const appUrl = import.meta.env.VITE_APP_URL as string;

  return (
    <div class="flex h-full items-center gap-6">
      <div class="flex flex-col items-end text-right">
        <span class="text-sm font-black tracking-widest text-white/70 uppercase italic">{t("home.joinLobby")}</span>
        <span class="text-7xl leading-none text-display">{props.code}</span>
        <span class="mt-2 text-sm text-white/60">{appUrl.replace(/^https?:\/\//, "")}/join</span>
      </div>
      <QRCodeView value={`${appUrl}/join/${props.code}`} class="h-full" />
    </div>
  );
}

interface ModeCardProps {
  selected?: boolean;
  active?: boolean;
  label: string;
  gradient?: string;
  icon?: Component<{ class?: string; classList?: Record<string, boolean | undefined> }>;
  description?: string;
}

/**
 * A tall mode card; the selected one grows wide and reveals its description.
 * Only the card's width animates: the icon and label scale with transforms and
 * the description has a fixed width, so no text re-wraps mid-animation.
 */
function ModeCard(props: ModeCardProps) {
  return (
    <div
      class="relative flex min-w-0 flex-col justify-end overflow-hidden rounded-2xl bg-linear-to-b p-8 transition-[flex-grow,translate,scale,box-shadow,opacity,filter] duration-300 ease-out"
      classList={{
        [props.gradient || ""]: true,
        "grow-[2.6] -translate-y-2 shadow-[0.6cqw_0.6cqw_0_rgb(0_0_0/0.4)]": props.selected && !props.active,
        "grow-[2.6] scale-[0.97] shadow-[0.3cqw_0.3cqw_0_rgb(0_0_0/0.4)]": props.selected && props.active,
        "grow opacity-60 saturate-50": !props.selected,
      }}
      style={{ "flex-basis": "0" }}
      aria-hidden="true"
    >
      <Show when={props.selected && effectsEnabled()}>
        <div class="absolute inset-0 animate-stripes-move bg-stripes opacity-10" style={{ "--fx-color": "white" }} />
      </Show>
      {/* Same icon area in every card (a size container), so the icon fits any
          aspect ratio; unselected cards show it smaller. */}
      <div class="[container-type:size] absolute inset-x-0 top-0 bottom-[42%] flex items-center justify-center p-6">
        <div
          class="transition-transform duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
          style={{ transform: props.selected ? "scale(1) rotate(-6deg)" : "scale(0.6) rotate(0deg)" }}
        >
          <div classList={{ "animate-float": props.selected && effectsEnabled() }}>
            <Dynamic component={props.icon} class="block text-[min(85cqh,70cqw)] drop-shadow-lg" />
          </div>
        </div>
      </div>
      <div class="relative">
        <div
          class="origin-bottom-left text-6xl text-display whitespace-nowrap transition-transform duration-300 ease-out"
          style={{ transform: props.selected ? "scale(1)" : "scale(0.5)" }}
        >
          {props.label}
        </div>
        <div
          class="grid transition-[grid-template-rows] duration-300 ease-out"
          style={{ "grid-template-rows": props.selected ? "1fr" : "0fr" }}
        >
          <div class="overflow-hidden">
            <p
              class="w-[24cqw] pt-2 text-lg font-semibold transition-opacity"
              classList={{ "opacity-0 duration-100": !props.selected, "delay-200 duration-300": props.selected }}
            >
              {props.description}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
