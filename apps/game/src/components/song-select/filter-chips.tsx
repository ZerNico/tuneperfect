import { createMemo, For, Show } from "solid-js";
import IconX from "~icons/ph/x-bold";

import type { SongFilters } from "~/hooks/use-song-filter";
import { t } from "~/lib/i18n";
import { formatDecade, typeLabel } from "~/lib/utils/song-facets";

interface FilterChipsProps {
  filters: SongFilters;
  onChange: (filters: SongFilters) => void;
  /** Whether to show the solo/duet type chip. Defaults to true (local library). */
  showTypeFilter?: boolean;
}

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
      <div class="flex items-center gap-[0.5cqw]">
        <For each={activeChips()}>
          {(def) => (
            <button
              type="button"
              aria-label={`${def.label(props.filters)} (${t("sing.filter.clearAll")})`}
              class="gradient-sing flex h-[2.2cqw] max-w-[12cqw] cursor-pointer items-center gap-[0.4cqw] rounded-[0.6cqw] bg-linear-to-r px-[0.8cqw] text-[0.9cqw] font-bold text-white transition-[scale,filter] hover:brightness-110 active:scale-95"
              onClick={() => props.onChange(def.reset(props.filters))}
            >
              <span class="truncate">{def.label(props.filters)}</span>
              <IconX class="shrink-0 opacity-80" />
            </button>
          )}
        </For>
      </div>
    </Show>
  );
}
