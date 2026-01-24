import { Show } from "solid-js";
import { keyMode } from "~/hooks/navigation";
import { t } from "~/lib/i18n";
import IconSearch from "~icons/lucide/search";
import IconF3Key from "~icons/sing/f3-key";
import IconGamepadStart from "~icons/sing/gamepad-start";
import type { SearchFilter } from "./song-scroller";

interface SearchButtonProps {
  searchQuery: string;
  searchFilter: SearchFilter;
  onClick: () => void;
}

const FILTER_LABELS: Record<SearchFilter, () => string> = {
  all: () => t("sing.filter.all"),
  artist: () => t("sing.sort.artist"),
  title: () => t("sing.sort.title"),
  year: () => t("sing.sort.year"),
  genre: () => t("sing.filter.genre"),
  language: () => t("sing.filter.language"),
  edition: () => t("sing.filter.edition"),
  creator: () => t("sing.filter.creator"),
};

export function SearchButton(props: SearchButtonProps) {
  const filterLabel = () => FILTER_LABELS[props.searchFilter]();

  return (
    <button
      type="button"
      class="flex w-40 items-center gap-1 rounded-full border-[0.12cqw] border-white px-1 py-0.5 text-sm transition-all hover:opacity-75 active:scale-95"
      onClick={props.onClick}
    >
      <IconSearch class="shrink-0" />
      <div class="flex w-full min-w-0 items-center gap-2">
        <span class="grow truncate text-start">{props.searchQuery || t("sing.search")}</span>
        <Show when={props.searchQuery}>
          <span class="shrink-0 rounded-full bg-white/20 px-1.5 py-0.4 text-xs">{filterLabel()}</span>
        </Show>
      </div>
      <Show when={keyMode() === "keyboard"} fallback={<IconGamepadStart class="shrink-0 text-xs" />}>
        <IconF3Key class="shrink-0 text-xs" />
      </Show>
    </button>
  );
}
