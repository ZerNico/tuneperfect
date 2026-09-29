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

const DEFAULT_SORT_OPTIONS: SortOption[] = ["artist", "title", "year", "date"];

interface SortSelectProps {
  selected: SortOption;
  onSelect: (sort: SortOption) => void;
  options?: SortOption[];
}

export function SortSelect(props: SortSelectProps) {
  const sortOptions = () => props.options ?? DEFAULT_SORT_OPTIONS;

  const moveSorting = (direction: "left" | "right") => {
    const opts = sortOptions();
    const currentIndex = opts.indexOf(props.selected);
    const newIndex =
      direction === "left" ? (currentIndex - 1 + opts.length) % opts.length : (currentIndex + 1) % opts.length;
    props.onSelect(opts[newIndex] as SortOption);
  };

  return (
    <div class="flex items-center gap-3">
      <KeyGlyph keyboard={IconF6Key} gamepad={IconGamepadLB} class="text-sm opacity-70" />
      <div class="flex h-10 -skew-x-6 items-center gap-1 rounded-md bg-black/30 p-1 ring-1 ring-white/15 backdrop-blur-md ring-inset">
        <button
          type="button"
          class="skew-x-6 cursor-pointer px-1 text-lg active:scale-95"
          onClick={() => moveSorting("left")}
        >
          <IconCaretLeft />
        </button>
        <For each={sortOptions()}>
          {(sortOption) => {
            const selected = () => sortOption.toLowerCase() === props.selected;
            return (
              <button
                type="button"
                class="h-full cursor-pointer rounded-sm px-3 text-sm font-bold transition-all active:scale-95"
                classList={{
                  "gradient-sing bg-linear-to-r shadow-[0.2cqw_0.2cqw_0_rgb(0_0_0/0.3)]": selected(),
                  "opacity-60 hover:opacity-100": !selected(),
                }}
                onClick={() => props.onSelect(sortOption)}
              >
                <span class="inline-block skew-x-6">{t(`sing.sort.${sortOption}`)}</span>
              </button>
            );
          }}
        </For>
        <button
          type="button"
          class="skew-x-6 cursor-pointer px-1 text-lg active:scale-95"
          onClick={() => moveSorting("right")}
        >
          <IconCaretRight />
        </button>
      </div>
      <KeyGlyph keyboard={IconF7Key} gamepad={IconGamepadRB} class="text-sm opacity-70" />
    </div>
  );
}
