import { createEffect, createMemo, For, onCleanup, Show } from "solid-js";
import { Motion } from "solid-motionone";
import IconTrash from "~icons/lucide/trash-2";
import IconTriangleLeft from "~icons/sing/triangle-left";
import IconTriangleRight from "~icons/sing/triangle-right";

import { createLoop } from "~/hooks/loop";
import { useNavigation } from "~/hooks/navigation";
import { DEFAULT_FILTERS, type SongFilters, type SongLike, type SongTypeFilter } from "~/hooks/use-song-filter";
import { t } from "~/lib/i18n";
import { playSound } from "~/lib/sound";
import { formatDecade, getDecades, getEditions, getGenres, getLanguages } from "~/lib/utils/song-facets";

interface FilterPopupProps {
  songs: SongLike[];
  filters: SongFilters;
  onChange: (filters: SongFilters) => void;
  onClose: () => void;
  /** Whether to show the solo/duet type filter. Defaults to true (local library). */
  showTypeFilter?: boolean;
}

type RowKind = "type" | "decade" | "genre" | "language" | "edition" | "clear";

interface RowDescriptor {
  kind: RowKind;
  label: string;
  // For "clear" rows there is no value display.
  valueLabel?: string;
  // Whether the row currently has any non-default value (for visual highlight).
  active?: boolean;
  // Cycle handlers (omitted for "clear").
  onLeft?: () => void;
  onRight?: () => void;
  // Confirm handler (used by "clear" + treated as right cycle elsewhere).
  onConfirm?: () => void;
}

const TYPE_OPTIONS: SongTypeFilter[] = ["all", "solo", "duet"];

const cycle = <T,>(values: ReadonlyArray<T | null>, current: T | null, direction: "left" | "right"): T | null => {
  if (values.length === 0) return null;
  const index = values.findIndex((v) => v === current);
  const safeIndex = index === -1 ? 0 : index;
  const length = values.length;
  const nextIndex = direction === "right" ? (safeIndex + 1) % length : (safeIndex - 1 + length) % length;
  return values[nextIndex] ?? null;
};

export function FilterPopup(props: FilterPopupProps) {
  let popupRef!: HTMLDivElement;

  const facets = createMemo(() => ({
    decades: getDecades(props.songs),
    genres: getGenres(props.songs),
    languages: getLanguages(props.songs),
    editions: getEditions(props.songs),
  }));

  const update = (patch: Partial<SongFilters>) => {
    props.onChange({ ...props.filters, ...patch });
  };

  const cycleType = (direction: "left" | "right") => {
    const next = cycle<SongTypeFilter>(TYPE_OPTIONS, props.filters.type, direction) ?? "all";
    update({ type: next });
  };

  const cycleDecade = (direction: "left" | "right") => {
    const options: (number | null)[] = [null, ...facets().decades];
    update({ decade: cycle(options, props.filters.decade, direction) });
  };

  const cycleStringFacet = (key: "genre" | "language" | "edition", direction: "left" | "right") => {
    const list = key === "genre" ? facets().genres : key === "language" ? facets().languages : facets().editions;
    const options: (string | null)[] = [null, ...list];
    update({ [key]: cycle(options, props.filters[key], direction) } as Partial<SongFilters>);
  };

  const typeLabel = (value: SongTypeFilter): string => {
    if (value === "duet") return t("sing.filter.duet");
    if (value === "solo") return t("sing.filter.solo");
    return t("sing.filter.any");
  };

  const facetLabel = (value: string | null): string => value ?? t("sing.filter.any");
  const decadeLabel = (value: number | null): string => (value === null ? t("sing.filter.any") : formatDecade(value));

  const rows = createMemo<RowDescriptor[]>(() => {
    const f = props.filters;
    const list: RowDescriptor[] = [];

    if (props.showTypeFilter !== false) {
      list.push({
        kind: "type",
        label: t("sing.filter.type"),
        valueLabel: typeLabel(f.type),
        active: f.type !== "all",
        onLeft: () => cycleType("left"),
        onRight: () => cycleType("right"),
      });
    }

    if (facets().decades.length > 0) {
      list.push({
        kind: "decade",
        label: t("sing.filter.decade"),
        valueLabel: decadeLabel(f.decade),
        active: f.decade !== null,
        onLeft: () => cycleDecade("left"),
        onRight: () => cycleDecade("right"),
      });
    }

    if (facets().genres.length > 0) {
      list.push({
        kind: "genre",
        label: t("sing.filter.genre"),
        valueLabel: facetLabel(f.genre),
        active: f.genre !== null,
        onLeft: () => cycleStringFacet("genre", "left"),
        onRight: () => cycleStringFacet("genre", "right"),
      });
    }

    if (facets().languages.length > 0) {
      list.push({
        kind: "language",
        label: t("sing.filter.language"),
        valueLabel: facetLabel(f.language),
        active: f.language !== null,
        onLeft: () => cycleStringFacet("language", "left"),
        onRight: () => cycleStringFacet("language", "right"),
      });
    }

    if (facets().editions.length > 0) {
      list.push({
        kind: "edition",
        label: t("sing.filter.edition"),
        valueLabel: facetLabel(f.edition),
        active: f.edition !== null,
        onLeft: () => cycleStringFacet("edition", "left"),
        onRight: () => cycleStringFacet("edition", "right"),
      });
    }

    list.push({
      kind: "clear",
      label: t("sing.filter.clearAll"),
      onConfirm: () => props.onChange({ ...DEFAULT_FILTERS }),
    });

    return list;
  });

  const { position, increment, decrement, set } = createLoop(() => rows().length);

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

  useNavigation({
    layer: 1,
    onKeydown(event) {
      if (event.action === "back" || event.action === "filter") {
        props.onClose();
      } else if (event.action === "up") {
        decrement();
        playSound("select");
      } else if (event.action === "down") {
        increment();
        playSound("select");
      } else if (event.action === "left") {
        const row = rows()[position()];
        row?.onLeft?.();
        if (row?.onLeft) playSound("select");
      } else if (event.action === "right") {
        const row = rows()[position()];
        row?.onRight?.();
        if (row?.onRight) playSound("select");
      } else if (event.action === "confirm") {
        const row = rows()[position()];
        if (row?.kind === "clear") {
          row.onConfirm?.();
          playSound("confirm");
        } else {
          row?.onRight?.();
          if (row?.onRight) playSound("select");
        }
      }
    },
  });

  return (
    <div class="absolute top-full left-0 z-20 mt-2" ref={popupRef}>
      <Motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        class="w-96 rounded-lg bg-black/30 p-3 text-white shadow-xl backdrop-blur-md"
      >
        <div class="flex flex-col gap-1">
          <For each={rows()}>
            {(row, index) => {
              const selected = () => position() === index();
              return (
                <Show
                  when={row.kind !== "clear"}
                  fallback={
                    <button
                      type="button"
                      class="group relative mt-1 grid w-full overflow-hidden rounded-md text-left transition-all duration-200 active:scale-95"
                      classList={{
                        "bg-white/10": !selected(),
                        "shadow-lg": selected(),
                      }}
                      onClick={() => {
                        set(index());
                        row.onConfirm?.();
                        playSound("confirm");
                      }}
                      onMouseEnter={() => set(index())}
                    >
                      <div
                        class="col-start-1 row-start-1 h-full w-full bg-linear-to-r transition-opacity duration-200"
                        classList={{
                          "gradient-sing": true,
                          "opacity-0": !selected(),
                          "opacity-90": selected(),
                        }}
                      />
                      <div class="z-2 col-start-1 row-start-1 flex items-center justify-center gap-2 p-2 text-sm font-medium">
                        <IconTrash class="text-xs" />
                        <span>{row.label}</span>
                      </div>
                    </button>
                  }
                >
                  <div
                    class="flex items-center gap-3 rounded-md px-2 py-1.5 transition-all"
                    classList={{
                      "bg-white/10": selected(),
                    }}
                    onMouseEnter={() => set(index())}
                  >
                    <span
                      class="min-w-0 flex-1 truncate text-sm font-medium"
                      classList={{
                        "text-white": row.active || selected(),
                        "text-white/70": !row.active && !selected(),
                      }}
                    >
                      {row.label}
                    </span>
                    <div class="flex shrink-0 items-center gap-2">
                      <button
                        type="button"
                        class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-white/10 transition-transform hover:opacity-75 active:scale-95"
                        onClick={() => {
                          set(index());
                          row.onLeft?.();
                          playSound("select");
                        }}
                      >
                        <IconTriangleLeft class="text-xs" />
                      </button>
                      <div
                        class="w-40 truncate rounded-md px-3 py-0.5 text-center text-sm"
                        classList={{
                          "gradient-sing bg-linear-to-r font-semibold text-white": !!row.active,
                          "bg-white/10 text-white/70": !row.active,
                        }}
                        title={row.valueLabel}
                      >
                        {row.valueLabel}
                      </div>
                      <button
                        type="button"
                        class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-white/10 transition-transform hover:opacity-75 active:scale-95"
                        onClick={() => {
                          set(index());
                          row.onRight?.();
                          playSound("select");
                        }}
                      >
                        <IconTriangleRight class="text-xs" />
                      </button>
                    </div>
                  </div>
                </Show>
              );
            }}
          </For>
        </div>
      </Motion.div>
    </div>
  );
}
