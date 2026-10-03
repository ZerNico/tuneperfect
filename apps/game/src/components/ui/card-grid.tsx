import { For, type JSX, Show } from "solid-js";
import IconPlus from "~icons/ph/plus-bold";
import IconSpinner from "~icons/ph/spinner-gap-bold";

import { createListNavigation } from "~/hooks/list-navigation";
import { playSound } from "~/lib/sound";
import { getColorVar } from "~/lib/utils/color";

import Panel from "./panel";

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
 * A wrapping grid of cards (players, microphones, song folders) that scrolls vertically.
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
              <Panel
                as="button"
                type="button"
                ref={list.itemRef(index)}
                class="flex aspect-[4/5] w-full cursor-pointer flex-col items-center justify-center gap-3 p-4 text-center transition-[scale,opacity,translate] duration-150 active:scale-95"
                classList={{
                  "-translate-y-[0.4cqw] scale-105": selected() && !list.pressed(),
                  "scale-95": selected() && list.pressed(),
                  "opacity-70 hover:opacity-90": !selected(),
                }}
                surface="overflow-hidden rounded-[1.4cqw] transition-[background] duration-150"
                surfaceClassList={{
                  "bg-white/6": !selected() && !card.add,
                  "border-[0.18cqw] border-dashed border-white/30": !!card.add && !selected(),
                  "outline-[0.22cqw] outline-white": selected(),
                  [`${props.gradient ?? "gradient-settings"} bg-linear-to-b`]: selected() && !card.accent,
                }}
                surfaceStyle={
                  selected() && card.accent
                    ? { background: `linear-gradient(160deg, ${accent(400)}, ${accent(800)})` }
                    : undefined
                }
                surfaceContent={
                  // The card's colour as a soft light behind its picture.
                  <Show when={card.accent && !selected()}>
                    <span
                      class="absolute inset-0"
                      style={{
                        background: `radial-gradient(circle at 50% 38%, color-mix(in oklch, ${accent(500)} 22%, transparent), transparent 55%)`,
                      }}
                    />
                  </Show>
                }
                onMouseEnter={() => list.set(index())}
                onClick={() => activate(index())}
              >
                {/* Soft glow of the card's colour behind the selected card. */}
                <span
                  aria-hidden="true"
                  class={`pointer-events-none absolute inset-x-[10%] inset-y-[15%] -z-20 opacity-0 blur-[1.2cqw] transition-opacity duration-200 ${card.accent ? "" : `${props.gradient ?? "gradient-settings"} bg-linear-to-b`}`}
                  classList={{ "opacity-35": selected() }}
                  style={card.accent ? { background: accent(500) } : undefined}
                />
                <div class="flex h-[6cqw] items-center justify-center text-[4.5cqw]">
                  <Show when={card.loading} fallback={card.add ? <IconPlus /> : card.visual}>
                    <IconSpinner class="animate-spin" />
                  </Show>
                </div>
                <div class="flex w-full min-w-0 flex-col items-center">
                  <span class="w-full truncate text-xl font-bold">{card.label}</span>
                  <span class="h-5 w-full truncate text-sm font-semibold text-white/70">{card.subtitle}</span>
                </div>
              </Panel>
            );
          }}
        </For>
      </div>
    </div>
  );
}
