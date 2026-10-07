import { type Component, createSignal, For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";

import { createListNavigation } from "~/hooks/list-navigation";
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
  // Pressing a card with the pointer; the keyboard/gamepad press comes from the list.
  const [pointerPressed, setPointerPressed] = createSignal(false);

  const activate = (index: number) => {
    const card = props.cards[index];
    if (!card) return;
    playSound("confirm");
    card.action();
  };

  const list = createListNavigation({
    get count() {
      return props.cards.length;
    },
    layer: 0,
    keys: ["left", "right"],
    onActivate: activate,
    actions: {
      back: () => {
        props.onBack();
        playSound("confirm");
      },
    },
  });

  return (
    <div class={`relative flex min-h-0 gap-5 ${props.class ?? ""}`}>
      <For each={props.cards}>
        {(card, index) => (
          <ModeCard
            selected={list.isSelected(index())}
            active={(list.pressed() || pointerPressed()) && list.isSelected(index())}
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
              onMouseEnter={() => list.set(index())}
              // The cards sit below these zones, so the press is passed on by hand.
              onPointerDown={() => {
                list.set(index());
                setPointerPressed(true);
              }}
              onPointerUp={() => setPointerPressed(false)}
              onPointerLeave={() => setPointerPressed(false)}
              onClick={() => activate(index())}
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
      class="relative flex min-w-0 flex-col justify-end overflow-hidden rounded-[1.6cqw] bg-linear-to-b p-8 transition-[flex-grow,translate,scale,box-shadow,opacity,filter] duration-300 ease-out"
      classList={{
        [props.gradient || ""]: true,
        "grow-[2.6] focus-glow outline-[0.22cqw] outline-white": props.selected,
        "-translate-y-2": props.selected && !props.active,
        "scale-[0.97]": props.selected && props.active,
        "grow opacity-60 saturate-50": !props.selected,
      }}
      style={{ "flex-basis": "0" }}
      aria-hidden="true"
    >
      <Show when={props.selected && effectsEnabled()}>
        <div class="absolute inset-0 animate-stripes-move bg-stripes opacity-10" style={{ "--fx-color": "white" }} />
      </Show>
      {/* Same icon area in every card (a size container), so the icon fits any
          aspect ratio; unselected cards show it smaller. Nudged down from the top so the
          big icon sits between the top edge and the title, not against the top. */}
      <div class="[container-type:size] absolute inset-x-0 top-[6%] bottom-[36%] flex items-center justify-center p-6">
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
          class="origin-bottom-left text-6xl font-black whitespace-nowrap transition-transform duration-300 ease-out"
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
