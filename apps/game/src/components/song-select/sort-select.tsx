import { For, Show } from "solid-js";
import { keyMode } from "~/hooks/navigation";
import { t } from "~/lib/i18n";
import IconF5Key from "~icons/sing/f5-key";
import IconF6Key from "~icons/sing/f6-key";
import IconGamepadLB from "~icons/sing/gamepad-lb";
import IconGamepadRB from "~icons/sing/gamepad-rb";
import IconTriangleLeft from "~icons/sing/triangle-left";
import IconTriangleRight from "~icons/sing/triangle-right";
import type { SortOption } from "./song-scroller";

const SORT_OPTIONS: SortOption[] = ["artist", "title", "year"];

interface SortSelectProps {
  selected: SortOption;
  onSelect: (sort: SortOption) => void;
}

export function SortSelect(props: SortSelectProps) {
  const moveSorting = (direction: "left" | "right") => {
    const currentIndex = SORT_OPTIONS.indexOf(props.selected);
    const newIndex =
      direction === "left"
        ? (currentIndex - 1 + SORT_OPTIONS.length) % SORT_OPTIONS.length
        : (currentIndex + 1) % SORT_OPTIONS.length;
    props.onSelect(SORT_OPTIONS[newIndex] as SortOption);
  };

  return (
    <div class="flex items-center gap-2">
      <Show when={keyMode() === "keyboard"} fallback={<IconGamepadLB class="text-sm" />}>
        <IconF5Key class="text-sm" />
      </Show>
      <button
        type="button"
        class="flex cursor-pointer items-center gap-2 transition-all hover:opacity-75 active:scale-95"
        onClick={() => moveSorting("left")}
      >
        <IconTriangleLeft />
      </button>
      <div>
        <For each={SORT_OPTIONS}>
          {(sortOption) => (
            <button
              type="button"
              class="gradient-sing cursor-pointer rounded-full px-2 text-md text-white capitalize transition-all hover:opacity-75 active:scale-95"
              classList={{
                "gradient-sing bg-linear-to-b shadow-xl": sortOption.toLowerCase() === props.selected,
              }}
              onClick={() => props.onSelect(sortOption)}
            >
              {t(`sing.sort.${sortOption}`)}
            </button>
          )}
        </For>
      </div>
      <button
        type="button"
        class="flex cursor-pointer items-center gap-2 transition-all hover:opacity-75 active:scale-95"
        onClick={() => moveSorting("right")}
      >
        <IconTriangleRight />
        <Show when={keyMode() === "keyboard"} fallback={<IconGamepadRB class="text-sm" />}>
          <IconF6Key class="text-sm" />
        </Show>
      </button>
    </div>
  );
}
