import { createMemo, For } from "solid-js";
import IconX from "~icons/lucide/x";

import type { SongFilters, SongTypeFilter } from "~/hooks/use-song-filter";
import { t } from "~/lib/i18n";
import { formatDecade } from "~/lib/utils/song-facets";

interface FilterChipsProps {
  filters: SongFilters;
  onChange: (filters: SongFilters) => void;
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

const CHIP_DEFS: ChipDef[] = [
  {
    isActive: (f) => f.type !== "all",
    label: (f) => typeLabel(f.type),
    reset: (f) => ({ ...f, type: "all" }),
  },
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
  const activeChips = createMemo(() => CHIP_DEFS.filter((def) => def.isActive(props.filters)));

  return (
    <div class="flex items-center gap-1.5">
      <For each={activeChips()}>
        {(def) => (
          <button
            type="button"
            aria-label={`${def.label(props.filters)} (${t("sing.filter.clearAll")})`}
            class="flex max-w-40 items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-0.5 text-xs font-medium text-white backdrop-blur-md transition-all hover:bg-white/25 active:scale-95"
            onClick={() => props.onChange(def.reset(props.filters))}
          >
            <span class="truncate">{def.label(props.filters)}</span>
            <IconX class="shrink-0 text-[0.7rem] opacity-70" />
          </button>
        )}
      </For>
    </div>
  );
}
