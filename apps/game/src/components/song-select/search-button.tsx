import { Show } from "solid-js";
import IconSearch from "~icons/lucide/search";
import IconF3Key from "~icons/sing/f3-key";
import IconGamepadX from "~icons/sing/gamepad-x";

import { keyMode } from "~/hooks/navigation";
import type { SearchFieldScope } from "~/hooks/use-song-filter";
import { t } from "~/lib/i18n";

interface SearchButtonProps {
  searchQuery: string;
  searchFieldScope: SearchFieldScope;
  onClick: () => void;
}

const SCOPE_LABELS: Record<SearchFieldScope, () => string> = {
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
  const scopeLabel = () => SCOPE_LABELS[props.searchFieldScope]();

  return (
    <button
      type="button"
      class="flex w-40 items-center gap-1 rounded-full border-[0.12cqw] border-white px-1 py-0.5 text-sm transition-all hover:opacity-75 active:scale-95"
      onClick={() => props.onClick()}
    >
      <IconSearch class="shrink-0" />
      <div class="flex w-full min-w-0 items-center gap-2">
        <span class="grow truncate text-start">{props.searchQuery || t("sing.search")}</span>
        <Show when={props.searchQuery}>
          <span class="py-0.4 shrink-0 rounded-full bg-white/20 px-1.5 text-xs">{scopeLabel()}</span>
        </Show>
      </div>
      <Show when={keyMode() === "keyboard"} fallback={<IconGamepadX class="shrink-0 text-xs" />}>
        <IconF3Key class="shrink-0 text-xs" />
      </Show>
    </button>
  );
}
