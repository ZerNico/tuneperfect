import { createEffect, createSignal, For, on, onCleanup, onMount } from "solid-js";
import IconCaretLeft from "~icons/ph/caret-left-fill";
import IconCaretRight from "~icons/ph/caret-right-fill";
import IconF6Key from "~icons/sing/f6-key";
import IconF7Key from "~icons/sing/f7-key";
import IconGamepadLB from "~icons/sing/gamepad-lb";
import IconGamepadRB from "~icons/sing/gamepad-rb";

import type { SortOption } from "~/hooks/use-song-filter";
import { effectsEnabled } from "~/lib/fx";
import { t } from "~/lib/i18n";

import KeyGlyph from "../ui/key-glyph";

interface SortSelectProps {
  selected: SortOption;
  options: SortOption[];
  onSelect: (sort: SortOption) => void;
  /** The arrows: previous/next option, wrapping around. */
  onMove: (direction: -1 | 1) => void;
}

export function SortSelect(props: SortSelectProps) {
  // One highlight that slides to the selected option, measured from its button.
  const buttons = new Map<SortOption, HTMLButtonElement>();
  let track: HTMLDivElement | undefined;
  const [indicator, setIndicator] = createSignal<{ left: number; width: number }>();
  // No slide on the first placement (or after a resize), only when the selection changes.
  const [animate, setAnimate] = createSignal(false);

  const measure = () => {
    const button = buttons.get(props.selected);
    if (button) setIndicator({ left: button.offsetLeft, width: button.offsetWidth });
  };

  onMount(() => {
    measure();
    // Everything is sized in cqw, so the buttons change size with the window.
    const observer = new ResizeObserver(() => {
      setAnimate(false);
      measure();
    });
    if (track) observer.observe(track);
    onCleanup(() => observer.disconnect());
  });

  createEffect(
    on(
      () => props.selected,
      () => {
        setAnimate(effectsEnabled());
        measure();
      },
      { defer: true },
    ),
  );

  return (
    <div class="flex items-center gap-[0.6cqw]">
      <KeyGlyph keyboard={IconF6Key} gamepad={IconGamepadLB} class="text-[1.2cqw] opacity-70" />
      <div class="flex h-[2.6cqw] items-center gap-[0.2cqw] rounded-[0.9cqw] bg-black/45 p-[0.3cqw] ring-1 ring-white/10 ring-inset">
        <button
          type="button"
          class="flex h-full cursor-pointer items-center px-[0.3cqw] text-[1cqw] text-white/60 hover:text-white active:scale-95"
          onClick={() => props.onMove(-1)}
        >
          <IconCaretLeft />
        </button>
        <div ref={track} class="relative flex h-full items-center gap-[0.2cqw]">
          <span
            class="gradient-sing absolute inset-y-0 rounded-[0.6cqw] bg-linear-to-r"
            classList={{ "transition-[left,width] duration-250 ease-[cubic-bezier(0.2,0.8,0.2,1)]": animate() }}
            style={{
              left: `${indicator()?.left ?? 0}px`,
              width: `${indicator()?.width ?? 0}px`,
              opacity: indicator() ? 1 : 0,
            }}
          />
          <For each={props.options}>
            {(sortOption) => {
              const selected = () => sortOption === props.selected;
              return (
                <button
                  ref={(el) => buttons.set(sortOption, el)}
                  type="button"
                  class="relative flex h-full cursor-pointer items-center rounded-[0.6cqw] px-[1cqw] text-[1cqw] font-bold transition-[color,scale] duration-200 active:scale-95"
                  classList={{
                    "text-white": selected(),
                    "text-white/60 hover:text-white": !selected(),
                  }}
                  onClick={() => props.onSelect(sortOption)}
                >
                  {t(`sing.sort.${sortOption}`)}
                </button>
              );
            }}
          </For>
        </div>
        <button
          type="button"
          class="flex h-full cursor-pointer items-center px-[0.3cqw] text-[1cqw] text-white/60 hover:text-white active:scale-95"
          onClick={() => props.onMove(1)}
        >
          <IconCaretRight />
        </button>
      </div>
      <KeyGlyph keyboard={IconF7Key} gamepad={IconGamepadRB} class="text-[1.2cqw] opacity-70" />
    </div>
  );
}
