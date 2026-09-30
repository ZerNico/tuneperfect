import { For } from "solid-js";
import IconCaretLeft from "~icons/ph/caret-left-fill";
import IconCaretRight from "~icons/ph/caret-right-fill";
import IconF6Key from "~icons/sing/f6-key";
import IconF7Key from "~icons/sing/f7-key";
import IconGamepadLB from "~icons/sing/gamepad-lb";
import IconGamepadRB from "~icons/sing/gamepad-rb";

import type { SortOption } from "~/hooks/use-song-filter";
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
  return (
    <div class="flex items-center gap-[0.6cqw]">
      <KeyGlyph keyboard={IconF6Key} gamepad={IconGamepadLB} class="text-[1.2cqw] opacity-70" />
      <div class="flex h-[2.6cqw] items-center gap-[0.2cqw] rounded-[0.9cqw] bg-black/30 p-[0.3cqw] ring-1 ring-white/10 backdrop-blur-md ring-inset">
        <button
          type="button"
          class="flex h-full cursor-pointer items-center px-[0.3cqw] text-[1cqw] text-white/60 hover:text-white active:scale-95"
          onClick={() => props.onMove(-1)}
        >
          <IconCaretLeft />
        </button>
        <For each={props.options}>
          {(sortOption) => {
            const selected = () => sortOption === props.selected;
            return (
              <button
                type="button"
                class="flex h-full cursor-pointer items-center rounded-[0.6cqw] px-[1cqw] text-[1cqw] font-bold transition-[color,scale] active:scale-95"
                classList={{
                  "gradient-sing bg-linear-to-r": selected(),
                  "text-white/60 hover:text-white": !selected(),
                }}
                onClick={() => props.onSelect(sortOption)}
              >
                {t(`sing.sort.${sortOption}`)}
              </button>
            );
          }}
        </For>
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
