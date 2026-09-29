import { Show } from "solid-js";
import IconSearch from "~icons/ph/magnifying-glass-bold";
import IconF3Key from "~icons/sing/f3-key";
import IconGamepadX from "~icons/sing/gamepad-x";

import type { SearchFieldScope } from "~/hooks/use-song-filter";
import { t } from "~/lib/i18n";

import ChipButton from "../ui/chip-button";
import KeyGlyph from "../ui/key-glyph";

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
    <ChipButton
      class="w-56"
      icon={IconSearch}
      label={t("sing.search")}
      hint={<KeyGlyph keyboard={IconF3Key} gamepad={IconGamepadX} />}
      onClick={() => props.onClick()}
    >
      <span class="grow truncate text-start" classList={{ "opacity-60": !props.searchQuery }}>
        {props.searchQuery || t("sing.search")}
      </span>
      <Show when={props.searchQuery}>
        <span class="shrink-0 rounded-sm bg-white/20 px-1.5 text-xs uppercase">{scopeLabel()}</span>
      </Show>
    </ChipButton>
  );
}
