import { createMemo, For, Show } from "solid-js";
import IconX from "~icons/ph/x-bold";

import type { SongFilters, SongTypeFilter } from "~/hooks/use-song-filter";
import { t } from "~/lib/i18n";
import { formatDecade } from "~/lib/utils/song-facets";

interface FilterChipsProps {
  filters: SongFilters;
  onChange: (filters: SongFilters) => void;
  /** Whether to show the solo/duet type chip. Defaults to true (local library). */
  showTypeFilter?: boolean;
}

const typeLabel = (value: SongTypeFilter): string => {
  if (value === "duet") return t("sing.filter.duet");
  if (value === "solo") return t("sing.filter.solo");
  return t("sing.filter.any");
};

interface ChipDef {
  isActive: (f: SongFilters) => boolean;
  label: (f: SongFilters) => string;
  reset: (f: SongFilters) => SongFilters;
}

const TYPE_CHIP: ChipDef = {
  isActive: (f) => f.type !== "all",
  label: (f) => typeLabel(f.type),
  reset: (f) => ({ ...f, type: "all" }),
};

const CHIP_DEFS: ChipDef[] = [
  TYPE_CHIP,
  {
    isActive: (f) => f.decade !== null,
    label: (f) => (f.decade === null ? "" : formatDecade(f.decade)),
    reset: (f) => ({ ...f, decade: null }),
  },
  {
    isActive: (f) => f.genre !== null,
    label: (f) => f.genre ?? "",
    reset: (f) => ({ ...f, genre: null }),
  },
  {
    isActive: (f) => f.language !== null,
    label: (f) => f.language ?? "",
    reset: (f) => ({ ...f, language: null }),
  },
  {
    isActive: (f) => f.edition !== null,
    label: (f) => f.edition ?? "",
    reset: (f) => ({ ...f, edition: null }),
  },
];

export function FilterChips(props: FilterChipsProps) {
  const activeChips = createMemo(() =>
    CHIP_DEFS.filter((def) => {
      if (def === TYPE_CHIP && props.showTypeFilter === false) return false;
      return def.isActive(props.filters);
    }),
  );

  // Render nothing without active filters, so the toolbar doesn't get an extra gap.
  return (
    <Show when={activeChips().length > 0}>
      <div class="flex items-center gap-2">
        <For each={activeChips()}>
          {(def) => (
            <button
              type="button"
              aria-label={`${def.label(props.filters)} (${t("sing.filter.clearAll")})`}
              class="gradient-sing flex h-8 max-w-44 -skew-x-6 cursor-pointer items-center rounded-md bg-linear-to-r text-xs font-bold text-white shadow-[0.2cqw_0.2cqw_0_rgb(0_0_0/0.3)] transition-all hover:brightness-110 active:scale-95"
              onClick={() => props.onChange(def.reset(props.filters))}
            >
              <span class="flex min-w-0 skew-x-6 items-center gap-1.5 px-2.5">
                <span class="truncate">{def.label(props.filters)}</span>
                <IconX class="shrink-0 opacity-80" />
              </span>
            </button>
          )}
        </For>
      </div>
    </Show>
  );
}
