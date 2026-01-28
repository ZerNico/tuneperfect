import { createEffect, onCleanup, onMount, Show } from "solid-js";
import { Motion } from "solid-motionone";
import { VirtualKeyboard } from "~/components/ui/virtual-keyboard";
import { keyMode, useNavigation } from "~/hooks/navigation";
import { t } from "~/lib/i18n";
import IconF5Key from "~icons/sing/f5-key";
import IconF6Key from "~icons/sing/f6-key";
import IconGamepadLB from "~icons/sing/gamepad-lb";
import IconGamepadRB from "~icons/sing/gamepad-rb";
import IconTriangleLeft from "~icons/sing/triangle-left";
import IconTriangleRight from "~icons/sing/triangle-right";
import type { SearchFilter } from "./song-scroller";

interface SearchPopupProps {
  searchQuery: string;
  searchFilter: SearchFilter;
  onSearchQuery: (query: string) => void;
  onSearchFilter: (filter: SearchFilter) => void;
  onClose: () => void;
}

const FILTER_OPTIONS: { value: SearchFilter; label: () => string }[] = [
  { value: "all", label: () => t("sing.filter.all") },
  { value: "artist", label: () => t("sing.sort.artist") },
  { value: "title", label: () => t("sing.sort.title") },
  { value: "year", label: () => t("sing.sort.year") },
  { value: "genre", label: () => t("sing.filter.genre") },
  { value: "language", label: () => t("sing.filter.language") },
  { value: "edition", label: () => t("sing.filter.edition") },
  { value: "creator", label: () => t("sing.filter.creator") },
];

export function SearchPopup(props: SearchPopupProps) {
  let searchRef!: HTMLInputElement;
  let popupRef!: HTMLDivElement;

  createEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef && !popupRef.contains(event.target as Node)) {
        props.onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    onCleanup(() => {
      document.removeEventListener("mousedown", handleClickOutside);
    });
  });

  const onInput = (e: InputEvent & { currentTarget: HTMLInputElement }) => {
    props.onSearchQuery(e.currentTarget.value);
  };

  const moveFilter = (direction: "left" | "right") => {
    const currentIndex = FILTER_OPTIONS.findIndex((option) => option.value === props.searchFilter);
    const newIndex = (currentIndex + (direction === "left" ? -1 : 1) + FILTER_OPTIONS.length) % FILTER_OPTIONS.length;
    const newOption = FILTER_OPTIONS[newIndex];
    if (newOption) {
      props.onSearchFilter(newOption.value);
    }
  };

  useNavigation({
    layer: 1,
    onKeydown(event) {
      if (event.action === "back" || event.action === "search") {
        props.onClose();
      } else if (event.action === "filter-left") {
        moveFilter("left");
      } else if (event.action === "filter-right") {
        moveFilter("right");
      }
    },

    onKeyup(event) {
      if (event.origin === "keyboard") {
        if (event.action === "confirm" && event.originalKey !== " ") {
          props.onClose();
        }
      }
    },
  });

  onMount(() => {
    searchRef.focus();
  });

  const currentFilterLabel = () =>
    FILTER_OPTIONS.find((option) => option.value === props.searchFilter)?.label() || t("sing.filter.all");

  return (
    <div class="absolute top-full left-0 z-20 mt-2" ref={popupRef}>
      <Motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        class="w-96 rounded-lg bg-black/30 p-4 text-white shadow-xl backdrop-blur-md"
      >
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Show when={keyMode() === "keyboard"} fallback={<IconGamepadLB class="text-sm" />}>
                <IconF5Key class="text-sm" />
              </Show>
              <button
                type="button"
                class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-white/10 transition-transform hover:opacity-75 active:scale-95"
                onClick={() => moveFilter("left")}
              >
                <IconTriangleLeft class="text-xs" />
              </button>
            </div>

            <div class="flex justify-center">
              <div class="rounded-md bg-white/10 px-3 py-1">
                <span class="font-medium text-sm text-white">{currentFilterLabel()}</span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-white/10 transition-transform hover:opacity-75 active:scale-95"
                onClick={() => moveFilter("right")}
              >
                <IconTriangleRight class="text-xs" />
              </button>
              <Show when={keyMode() === "keyboard"} fallback={<IconGamepadRB class="text-sm" />}>
                <IconF6Key class="text-sm" />
              </Show>
            </div>
          </div>

          <input
            value={props.searchQuery}
            onInput={onInput}
            ref={searchRef}
            type="text"
            placeholder={t("sing.search")}
            class="focus:gradient-sing w-full rounded-md bg-white/10 px-3 py-2 text-white placeholder-gray-400 transition-all focus:bg-linear-to-r focus:outline-none"
          />
        </div>

        <Show when={keyMode() === "gamepad"}>
          <div class="mt-4 flex justify-center">
            <VirtualKeyboard inputRef={searchRef} layer={1} onClose={props.onClose} />
          </div>
        </Show>
      </Motion.div>
    </div>
  );
}
