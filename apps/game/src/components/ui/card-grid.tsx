import { For, type JSX, Show } from "solid-js";
import IconPlus from "~icons/ph/plus-bold";
import IconSpinner from "~icons/ph/spinner-gap-bold";

import { createListNavigation } from "~/hooks/list-navigation";
import { playSound } from "~/lib/sound";
import { getColorVar } from "~/lib/utils/color";

import SlantPanel from "./slant-panel";

export interface GridCard {
  id: string;
  label: string;
  subtitle?: string;
  /** Big picture in the card: an avatar or an icon. Not used by "add" cards. */
  visual?: JSX.Element;
  /** Colour name (e.g. "sky") for the selected card and its stripe; defaults to the settings gradient. */
  accent?: string;
  /** Dashed "add new" card. */
  add?: boolean;
  loading?: boolean;
  action: () => void;
}

interface CardGridProps {
  cards: GridCard[];
  onBack: () => void;
  /** Cards per row; the arrow keys move within this grid. */
  columns?: number;
  /** Mode gradient for selected cards without their own accent. Defaults to the settings gradient. */
  gradient?: string;
}

/**
 * A wrapping grid of slanted cards (players, microphones, song folders) that scrolls vertically.
 * Arrows move in two dimensions, the mouse selects by hover, confirm opens.
 */
export default function CardGrid(props: CardGridProps) {
  const columns = () => props.columns ?? 5;

  const activate = (index: number) => {
    const card = props.cards[index];
    if (!card || card.loading) return;
    playSound("confirm");
    card.action();
  };

  const list = createListNavigation({
    get count() {
      return props.cards.length;
    },
    layer: 0,
    get columns() {
      return columns();
    },
    // Centred: at the start and end this clamps, so the padding (room for the enlarged card) stays visible.
    scrollBlock: "center",
    onActivate: activate,
    onKeydown(event) {
      if (event.action === "back") props.onBack();
    },
  });

  return (
    <div class="styled-scrollbars max-h-full w-full overflow-y-auto">
      {/* A real grid, left-aligned: every card sits in the column the arrow keys expect, also in a short
          last row. With fewer cards than columns the grid shrinks to them, so they stay centred. */}
      <div
        // Padding here, not on the scroller: it's scrollable space, room for the enlarged selected card.
        class="mx-auto grid w-fit content-start gap-[2cqw] px-[1.5cqw] py-[2.5cqw]"
        style={{ "grid-template-columns": `repeat(${Math.min(columns(), props.cards.length)}, 14cqw)` }}
      >
        <For each={props.cards}>
          {(card, index) => {
            const selected = () => list.isSelected(index());
            const accent = (shade: 400 | 500 | 800) => (card.accent ? getColorVar(card.accent, shade) : undefined);
            return (
              <SlantPanel
                as="button"
                type="button"
                ref={list.itemRef(index)}
                class="flex aspect-[4/5] w-full cursor-pointer flex-col items-center justify-center gap-3 p-4 text-center transition-[scale,opacity] duration-150 active:scale-95"
                classList={{
                  "scale-105": selected() && !list.pressed(),
                  "scale-95": selected() && list.pressed(),
                  "opacity-65 hover:opacity-90": !selected(),
                }}
                surface="overflow-hidden rounded-2xl transition-[box-shadow,background] duration-150"
                surfaceClassList={{
                  "bg-white/6 ring-1 ring-white/12 ring-inset": !selected() && !card.add,
                  "border-[0.2cqw] border-dashed border-white/35": !!card.add && !selected(),
                  "shadow-[0.45cqw_0.45cqw_0_rgb(0_0_0/0.4)]": selected(),
                  [`${props.gradient ?? "gradient-settings"} bg-linear-to-b`]: selected() && !card.accent,
                }}
                surfaceStyle={
                  selected() && card.accent
                    ? { background: `linear-gradient(160deg, ${accent(400)}, ${accent(800)})` }
                    : undefined
                }
                surfaceContent={
                  <>
                    <Show when={card.accent && !selected()}>
                      <span class="absolute inset-y-0 left-0 w-[0.45cqw]" style={{ background: accent(500) }} />
                    </Show>
                    <Show when={selected()}>
                      <span class="absolute inset-0 bg-stripes opacity-10 [--fx-color:white]" />
                    </Show>
                  </>
                }
                onMouseEnter={() => list.set(index())}
                onClick={() => activate(index())}
              >
                <div class="flex h-[6cqw] items-center justify-center text-[4.5cqw]">
                  <Show when={card.loading} fallback={card.add ? <IconPlus /> : card.visual}>
                    <IconSpinner class="animate-spin" />
                  </Show>
                </div>
                <div class="flex w-full min-w-0 flex-col items-center">
                  <span class="w-full truncate text-xl font-bold">{card.label}</span>
                  <span class="h-5 w-full truncate text-sm font-semibold text-white/70">{card.subtitle}</span>
                </div>
              </SlantPanel>
            );
          }}
        </For>
      </div>
    </div>
  );
}
