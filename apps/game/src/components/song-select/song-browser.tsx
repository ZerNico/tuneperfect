import type MiniSearch from "minisearch";
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  Match,
  on,
  Show,
  Switch,
  untrack,
} from "solid-js";
import IconCoverflow from "~icons/ph/cards-fill";
import IconDices from "~icons/ph/dice-five-fill";
import IconMenu from "~icons/ph/list-bold";
import IconMusic from "~icons/ph/music-notes-fill";
import IconGrid from "~icons/ph/squares-four-fill";
import IconF5Key from "~icons/sing/f5-key";
import IconGamepadSelect from "~icons/sing/gamepad-select";
import IconGamepadStart from "~icons/sing/gamepad-start";
import IconTabKey from "~icons/sing/tab-key";

import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import TitleBar from "~/components/title-bar";
import ChipButton from "~/components/ui/chip-button";
import KeyGlyph from "~/components/ui/key-glyph";
import { useNavigation } from "~/hooks/navigation";
import {
  countActiveFilters,
  DEFAULT_FILTERS,
  type SearchFieldScope,
  type SongFilters,
  type SongLike,
  type SortOption,
  useSongFilter,
} from "~/hooks/use-song-filter";
import { t } from "~/lib/i18n";
import { OK, STALE, useRemoteExtras } from "~/lib/remote";
import { playSound } from "~/lib/sound";
import { formatDecade, getFacets, typeLabel } from "~/lib/utils/song-facets";
import { settingsStore } from "~/stores/settings";

import { FilterButton } from "./filter-button";
import { FilterChips } from "./filter-chips";
import { FilterPopup } from "./filter-popup";
import { MenuPopup, type MenuPopupItem } from "./menu-popup";
import { SearchButton } from "./search-button";
import { SCOPE_OPTIONS, SearchPopup } from "./search-popup";
import { SongCard, SongGridCard } from "./song-card";
import { SongGrid, type SongGridRef } from "./song-grid";
import { SongScroller, type SongScrollerRef } from "./song-scroller";
import { type SongInfo, SongTitle } from "./song-title";
import { SortSelect } from "./sort-select";

export type SongBrowserView = "grid" | "coverflow";

/**
 * Search, filter, sort and selection of a browser. Create it at module level to
 * keep it across visits (local library) or inside the route to reset it (online).
 */
export function createSongBrowserState(defaultSort: SortOption) {
  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchFieldScope, setSearchFieldScope] = createSignal<SearchFieldScope>("all");
  const [filters, setFilters] = createSignal<SongFilters>({ ...DEFAULT_FILTERS });
  const [sortOption, setSortOption] = createSignal<SortOption>(defaultSort);
  const [selectedId, setSelectedId] = createSignal<string | null>(null);

  return {
    searchQuery,
    setSearchQuery,
    searchFieldScope,
    setSearchFieldScope,
    filters,
    setFilters,
    sortOption,
    setSortOption,
    selectedId,
    setSelectedId,
  };
}

export type SongBrowserState = ReturnType<typeof createSongBrowserState>;

interface SongBrowserProps<T extends SongLike> {
  title: string;
  state: SongBrowserState;
  /** Unfiltered items; the browser searches, filters and sorts them. */
  items: T[];
  getId: (item: T) => string;
  describe: (item: T) => SongInfo;
  coverOf: (item: T) => string | null;
  /** Defer cover loading while scrolling (remote catalogues). */
  lazyCovers?: boolean;
  sortOptions: SortOption[];
  /** Prebuilt search index over `items` (see `createSongSearchIndex`). */
  searchIndex: Accessor<MiniSearch<T>>;
  /** Whether solo/duet can be filtered. Defaults to true (local library). */
  showTypeFilter?: boolean;
  countLabel: (filtered: number, total: number) => string;
  emptyLabel?: string;
  /** Called after back has nothing left to clear (search, then filters). */
  onBack: () => void;
  onConfirm: (item: T) => void;
  /** Called once per change of the selected song; null while nothing matches. */
  onSelectedChange?: (item: T | null) => void;
  /** Screen-specific entries for the top-right menu, after the view switch. */
  menuItems?: MenuPopupItem[];
  /** Next to the title panel, e.g. highscores. Called once per view; `item` follows the selection. */
  side?: (item: Accessor<T | null>, view: SongBrowserView) => JSX.Element;
  background?: JSX.Element;
}

/**
 * The song browsing experience shared by the local library and the online
 * catalogue: toolbar, grid or coverflow (per settings), title panel and all
 * keyboard/gamepad/mouse controls.
 */
export function SongBrowser<T extends SongLike>(props: SongBrowserProps<T>) {
  // The state object and filter configuration are fixed for the browser's lifetime.
  // oxlint-disable-next-line solid/reactivity
  const state = props.state;
  const [openPanel, setOpenPanel] = createSignal<"search" | "filter" | "menu" | null>(null);
  const togglePanel = (panel: "search" | "filter" | "menu") =>
    setOpenPanel((current) => (current === panel ? null : panel));

  const filteredItems = useSongFilter<T>({
    items: () => props.items,
    getId: (item) => props.getId(item),
    searchIndex: () => props.searchIndex(),
    sortOption: state.sortOption,
    searchQuery: state.searchQuery,
    searchFieldScope: state.searchFieldScope,
    filters: state.filters,
  });

  // Falls back to the first result like the grid and coverflow do, so a selected song
  // dropping out of the results switches straight to the new one (no null in between).
  // Built once per result list, so moving through the songs is a lookup instead of a search.
  const itemsById = createMemo(() => new Map(filteredItems().map((item) => [props.getId(item), item])));
  const selected = createMemo(() => {
    const id = state.selectedId();
    return (id === null ? undefined : itemsById().get(id)) ?? filteredItems()[0] ?? null;
  });
  const selectedInfo = createMemo(() => {
    const item = selected();
    return item ? props.describe(item) : null;
  });

  // The one place that reports the selection: the grid and coverflow only update the id,
  // and unmount without reporting when nothing matches.
  createEffect(on(selected, (item) => props.onSelectedChange?.(item)));

  const handleSelectionChange = (item: T | null) => state.setSelectedId(item ? props.getId(item) : null);

  const view = (): SongBrowserView => settingsStore.general().songSelectStyle;
  const toggleView = () =>
    settingsStore.saveGeneral({
      ...settingsStore.general(),
      songSelectStyle: view() === "grid" ? "coverflow" : "grid",
    });

  const menuItems = (): MenuPopupItem[] => [
    {
      label: (
        <span class="flex items-center gap-2">
          {view() === "grid" ? <IconCoverflow /> : <IconGrid />}
          {view() === "grid" ? t("sing.menu.showCoverflow") : t("sing.menu.showGrid")}
        </span>
      ),
      action: toggleView,
    },
    ...(props.menuItems ?? []),
  ];
  let gridRef: SongGridRef<T> | undefined;
  let scrollerRef: SongScrollerRef<T> | undefined;

  const selectRandom = () => {
    // The grid/coverflow reports the new song like any other move.
    if (view() === "grid") gridRef?.goToRandomSong();
    else scrollerRef?.goToRandomSong();
    playSound("select");
  };

  const moveSort = (direction: -1 | 1) => {
    const options = props.sortOptions;
    const index = options.indexOf(state.sortOption());
    state.setSortOption(options[(index + direction + options.length) % options.length] ?? options[0]!);
    playSound("select");
  };

  const back = () => {
    playSound("confirm");
    if (state.searchQuery().trim()) {
      state.setSearchQuery("");
    } else if (countActiveFilters(state.filters()) > 0) {
      state.setFilters({ ...DEFAULT_FILTERS });
    } else {
      props.onBack();
    }
  };

  const confirm = () => {
    const item = selected();
    if (item) props.onConfirm(item);
  };

  const toggle = (panel: Parameters<typeof togglePanel>[0]) => () => {
    togglePanel(panel);
    playSound("select");
  };

  useNavigation({
    actions: {
      back,
      search: toggle("search"),
      filter: toggle("filter"),
      menu: toggle("menu"),
      random: selectRandom,
      "sort-left": () => moveSort(-1),
      "sort-right": () => moveSort(1),
      confirm: { up: confirm },
    },
  });

  const total = () => props.items.length;

  // Phones with full control type the search and pick the sort and filters directly; the pad does
  // the rest. Always, also while a popup is open: the popups show the same state.
  const filterOptions = createMemo(() => {
    const facets = getFacets(props.items);
    const strings = (values: string[]) => values.map((value) => ({ value, label: value }));
    const list: { id: keyof SongFilters; label: string; options: { value: string; label: string }[] }[] = [];
    if (props.showTypeFilter !== false) {
      list.push({
        id: "type",
        label: t("sing.filter.type"),
        options: (["solo", "duet"] as const).map((value) => ({ value, label: typeLabel(value) })),
      });
    }
    const decades = facets.decades.map((decade) => ({ value: String(decade), label: formatDecade(decade) }));
    if (decades.length > 0) list.push({ id: "decade", label: t("sing.filter.decade"), options: decades });
    if (facets.genres.length > 0)
      list.push({ id: "genre", label: t("sing.filter.genre"), options: strings(facets.genres) });
    if (facets.languages.length > 0) {
      list.push({ id: "language", label: t("sing.filter.language"), options: strings(facets.languages) });
    }
    if (facets.editions.length > 0) {
      list.push({ id: "edition", label: t("sing.filter.edition"), options: strings(facets.editions) });
    }
    return list;
  });

  /** A filter's value as phones see it: null while it's off. */
  const filterValue = (filters: SongFilters, id: keyof SongFilters): string | null => {
    const value = filters[id];
    if (id === "type") return value === "all" ? null : String(value);
    return value === null ? null : String(value);
  };

  useRemoteExtras({
    layer: false,
    text: () => ({ label: t("sing.search"), value: state.searchQuery(), set: state.setSearchQuery }),
    songs: () => {
      const item = selected();
      const info = item ? props.describe(item) : null;
      const filters = state.filters();
      return {
        sort: state.sortOption(),
        sorts: props.sortOptions.map((option) => ({ value: option, label: t(`sing.sort.${option}`) })),
        scope: state.searchFieldScope(),
        scopes: SCOPE_OPTIONS.map((option) => ({ value: option.value, label: option.label() })),
        setScope: (scope) => {
          const option = SCOPE_OPTIONS.find((candidate) => candidate.value === scope);
          if (!option) return STALE;
          state.setSearchFieldScope(option.value);
          playSound("select");
          return OK;
        },
        filters: filterOptions().map((filter) => ({ ...filter, value: filterValue(filters, filter.id) })),
        song: item && info ? { hash: props.getId(item), title: info.title, artist: info.artist } : null,
        setSort: (sort) => {
          const option = props.sortOptions.find((candidate) => candidate === sort);
          if (!option) return STALE;
          state.setSortOption(option);
          playSound("select");
          return OK;
        },
        setFilter: (id, value) => {
          const filter = filterOptions().find((candidate) => candidate.id === id);
          if (!filter || (value !== null && !filter.options.some((option) => option.value === value))) return STALE;
          const current = state.filters();
          if (filter.id === "type") state.setFilters({ ...current, type: (value ?? "all") as SongFilters["type"] });
          else if (filter.id === "decade")
            state.setFilters({ ...current, decade: value === null ? null : Number(value) });
          else state.setFilters({ ...current, [filter.id]: value });
          playSound("select");
          return OK;
        },
      };
    },
  });

  return (
    <Layout
      intent="secondary"
      background={props.background}
      header={
        <div class="flex items-center justify-between gap-12">
          <div class="flex items-center gap-12">
            <TitleBar title={props.title} onBack={back} />
            <div class="relative flex items-center gap-3">
              <SearchButton
                searchQuery={state.searchQuery()}
                searchFieldScope={state.searchFieldScope()}
                onClick={() => setOpenPanel("search")}
              />
              <Show when={openPanel() === "search"}>
                <SearchPopup
                  searchQuery={state.searchQuery()}
                  searchFieldScope={state.searchFieldScope()}
                  onSearchQuery={state.setSearchQuery}
                  onSearchFieldScope={state.setSearchFieldScope}
                  onClose={() => setOpenPanel(null)}
                />
              </Show>
              <div class="relative">
                <FilterButton onClick={() => setOpenPanel("filter")} />
                <Show when={openPanel() === "filter"}>
                  <FilterPopup
                    songs={props.items}
                    filters={state.filters()}
                    onChange={state.setFilters}
                    onClose={() => setOpenPanel(null)}
                    showTypeFilter={props.showTypeFilter}
                  />
                </Show>
              </div>
              <FilterChips
                filters={state.filters()}
                onChange={state.setFilters}
                showTypeFilter={props.showTypeFilter}
              />
              <ChipButton static icon={IconMusic}>
                {props.countLabel(filteredItems().length, total())}
              </ChipButton>
            </div>
          </div>
          <div class="relative">
            <ChipButton
              icon={IconMenu}
              label={t("sing.menu.title")}
              leadingHint={<KeyGlyph keyboard={IconTabKey} gamepad={IconGamepadStart} />}
              onClick={() => setOpenPanel("menu")}
            >
              {t("sing.menu.title")}
            </ChipButton>
            <Show when={openPanel() === "menu"}>
              <MenuPopup items={menuItems()} onClose={() => setOpenPanel(null)} />
            </Show>
          </div>
        </div>
      }
      footer={
        <div class="flex justify-between">
          <KeyHints hints={["back", "navigate", "confirm"]} />
          <div class="flex items-center gap-12">
            <ChipButton
              icon={IconDices}
              label={t("sing.random")}
              leadingHint={<KeyGlyph keyboard={IconF5Key} gamepad={IconGamepadSelect} />}
              onClick={selectRandom}
            >
              {t("sing.random")}
            </ChipButton>
            <SortSelect
              selected={state.sortOption()}
              options={props.sortOptions}
              onSelect={state.setSortOption}
              onMove={moveSort}
            />
          </div>
        </div>
      }
    >
      <Show
        when={filteredItems().length > 0}
        fallback={
          <div class="flex h-full items-center justify-center">
            <p class="text-xl font-bold opacity-60">{props.emptyLabel ?? t("online.noResults")}</p>
          </div>
        }
      >
        <Switch>
          <Match when={view() === "grid"}>
            <div class="relative flex h-full min-h-0 gap-8">
              <div class="relative -ml-8 w-1/2">
                <SongGrid
                  ref={gridRef}
                  items={filteredItems()}
                  getId={props.getId}
                  initialId={state.selectedId() ?? undefined}
                  class="absolute inset-0"
                  renderCard={(item, isSelected) => (
                    <SongGridCard
                      coverUrl={props.coverOf(item)}
                      title={item.title}
                      selected={isSelected()}
                      lazy={props.lazyCovers}
                    />
                  )}
                  onSelectedItemChange={handleSelectionChange}
                  onConfirm={props.onConfirm}
                />
              </div>
              <div class="flex w-1/2 flex-col">
                <div class="flex h-1/3 items-center">
                  <SongTitle song={selectedInfo()} />
                </div>
                <div class="mt-8 flex min-h-0 flex-1 gap-2">{untrack(() => props.side?.(selected, "grid"))}</div>
              </div>
            </div>
          </Match>
          <Match when={view() === "coverflow"}>
            <div class="relative grid h-full grid-rows-[1fr_auto]">
              <div class="flex grow items-center">
                <div class="flex grow flex-col">
                  <SongTitle song={selectedInfo()} maxWidthClass="max-w-200" />
                </div>
                <div class="flex h-full gap-2">{untrack(() => props.side?.(selected, "coverflow"))}</div>
              </div>
              <SongScroller
                ref={scrollerRef}
                items={filteredItems()}
                getId={props.getId}
                initialId={state.selectedId() ?? undefined}
                class="-mx-16 h-80 w-[calc(100%+8cqw)]"
                onCenteredItemChange={handleSelectionChange}
                onConfirm={props.onConfirm}
              >
                {(item, _index, itemState) => (
                  <SongCard
                    coverUrl={props.coverOf(item)}
                    title={item.title}
                    emphasis={itemState().emphasis}
                    lazy={props.lazyCovers}
                  />
                )}
              </SongScroller>
            </div>
          </Match>
        </Switch>
      </Show>
    </Layout>
  );
}
