import { type Component, createEffect, createSignal, For, on, Show } from "solid-js";
import { Dynamic } from "solid-js/web";

import { createLoop } from "~/hooks/loop";
import { useNavigation } from "~/hooks/navigation";
import { effectsEnabled } from "~/lib/fx";
import { playSound } from "~/lib/sound";

export interface ModeCardItem {
  label: string;
  gradient: string;
  icon: Component<{ class?: string; classList?: Record<string, boolean | undefined> }>;
  description: string;
  action: () => void;
}

interface ModeCardRowProps {
  cards: ModeCardItem[];
  onBack: () => void;
  class?: string;
}

/**
 * A row of big mode cards (home, party hub): left/right or the mouse selects, confirm opens.
 * The selected card grows; fixed, equal-width hit zones sit on top so the selection doesn't
 * jump under a still pointer while the cards resize.
 */
export default function ModeCardRow(props: ModeCardRowProps) {
  const [pressed, setPressed] = createSignal(false);
  const { position, increment, decrement, set } = createLoop(() => props.cards.length);

  useNavigation(() => ({
    layer: 0,
    onKeydown(event) {
      if (event.action === "back") {
        props.onBack();
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
        props.cards[position()]?.action();
      }
    },
  }));

  createEffect(on(position, () => playSound("select"), { defer: true }));

  return (
    <div class={`relative flex min-h-0 gap-5 ${props.class ?? ""}`}>
      <For each={props.cards}>
        {(card, index) => (
          <ModeCard
            selected={position() === index()}
            active={pressed() && position() === index()}
            label={card.label}
            gradient={card.gradient}
            icon={card.icon}
            description={card.description}
          />
        )}
      </For>
      <div class="absolute inset-0 flex">
        <For each={props.cards}>
          {(card, index) => (
            <button
              type="button"
              class="h-full flex-1 cursor-pointer"
              aria-label={card.label}
              onMouseEnter={() => set(index())}
              // The cards sit below these zones, so the press is passed on by hand.
              onPointerDown={() => {
                set(index());
                setPressed(true);
              }}
              onPointerUp={() => setPressed(false)}
              onPointerLeave={() => setPressed(false)}
              onClick={() => card.action()}
            />
          )}
        </For>
      </div>
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
