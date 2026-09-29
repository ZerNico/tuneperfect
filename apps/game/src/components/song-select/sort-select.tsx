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
import SlantPanel from "../ui/slant-panel";

interface SortSelectProps {
  selected: SortOption;
  options: SortOption[];
  onSelect: (sort: SortOption) => void;
  /** The arrows: previous/next option, wrapping around. */
  onMove: (direction: -1 | 1) => void;
}

export function SortSelect(props: SortSelectProps) {
  return (
    <div class="flex items-center gap-3">
      <KeyGlyph keyboard={IconF6Key} gamepad={IconGamepadLB} class="text-sm opacity-70" />
      <SlantPanel
        class="flex h-10 items-center gap-1 p-1"
        surface="rounded-md bg-black/30 ring-1 ring-white/15 backdrop-blur-md ring-inset"
      >
        <button type="button" class="cursor-pointer px-1 text-lg active:scale-95" onClick={() => props.onMove(-1)}>
          <IconCaretLeft />
        </button>
        <For each={props.options}>
          {(sortOption) => {
            const selected = () => sortOption === props.selected;
            return (
              <SlantPanel
                as="button"
                type="button"
                class="flex h-full cursor-pointer items-center px-3 text-sm font-bold transition-[opacity,scale] active:scale-95"
                classList={{ "opacity-60 hover:opacity-100": !selected() }}
                surface="rounded-sm"
                surfaceClassList={{
                  "gradient-sing bg-linear-to-r shadow-[0.2cqw_0.2cqw_0_rgb(0_0_0/0.3)]": selected(),
                }}
                onClick={() => props.onSelect(sortOption)}
              >
                {t(`sing.sort.${sortOption}`)}
              </SlantPanel>
            );
          }}
        </For>
        <button type="button" class="cursor-pointer px-1 text-lg active:scale-95" onClick={() => props.onMove(1)}>
          <IconCaretRight />
        </button>
      </SlantPanel>
      <KeyGlyph keyboard={IconF7Key} gamepad={IconGamepadRB} class="text-sm opacity-70" />
    </div>
  );
}
