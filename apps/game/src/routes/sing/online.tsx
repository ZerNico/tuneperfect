import { throttle } from "@solid-primitives/scheduled";
import { createVirtualizer } from "@tanstack/solid-virtual";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import IconGlobe from "~icons/lucide/globe";
import IconMusic from "~icons/lucide/music";

import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import { SearchButton } from "~/components/song-select/search-button";
import { SearchPopup } from "~/components/song-select/search-popup";
import { SortSelect } from "~/components/song-select/sort-select";
import TitleBar from "~/components/title-bar";
import { useNavigation } from "~/hooks/navigation";
import { type SearchFilter, type SortOption, useSongFilter } from "~/hooks/use-song-filter";
import { t } from "~/lib/i18n";
import { playSound } from "~/lib/sound";
import { notify } from "~/lib/toast";
import { useRoundActions } from "~/stores/round";
import { settingsStore } from "~/stores/settings";
import { type UsdbSearchEntry, usdbStore } from "~/stores/usdb";

import { commands } from "~/bindings";

export const Route = createFileRoute("/sing/online")({
  component: OnlineSearchComponent,
});

const COLUMNS = 5;
const GAP = 12;
const PADDING = 16;
const VERTICAL_PADDING = 20;
const SCROLL_PADDING = 20;
const ONLINE_SORT_OPTIONS: SortOption[] = ["views", "artist", "title", "year"];

function OnlineSearchComponent() {
  const navigate = useNavigate();
  const roundActions = useRoundActions();

  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchFilter, setSearchFilter] = createSignal<SearchFilter>("all");
  const [sort, setSort] = createSignal<SortOption>("views");
  const [searchPopupOpen, setSearchPopupOpen] = createSignal(false);
  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [startingGame, setStartingGame] = createSignal(false);
  const [rowHeight, setRowHeight] = createSignal(120);

  let containerRef!: HTMLDivElement;

  const { filteredItems } = useSongFilter<UsdbSearchEntry>({
    items: () => usdbStore.catalog(),
    sortOption: sort,
    searchQuery,
    searchFilter,
    idField: "songId",
    searchIndex: () => usdbStore.searchIndex(),
  });

  const filteredSongCount = createMemo(() => filteredItems().length);
  const rowCount = createMemo(() => Math.ceil(filteredItems().length / COLUMNS));

  const rows = createMemo(() => {
    const items = filteredItems();
    const result: UsdbSearchEntry[][] = [];
    for (let i = 0; i < items.length; i += COLUMNS) {
      result.push(items.slice(i, i + COLUMNS));
    }
    return result;
  });

  const virtualizer = createVirtualizer({
    get count() {
      return rowCount();
    },
    getScrollElement: () => containerRef,
    estimateSize: () => rowHeight(),
    overscan: 3,
  });

  onMount(() => {
    if (!containerRef) return;

    const measureRowHeight = () => {
      const containerWidth = containerRef.clientWidth;
      const cardWidth = (containerWidth - PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
      setRowHeight(cardWidth + GAP);
      virtualizer.measure();
    };

    measureRowHeight();
    const resizeObserver = new ResizeObserver(measureRowHeight);
    resizeObserver.observe(containerRef);
    onCleanup(() => resizeObserver.disconnect());
  });

  const [selectedSongId, setSelectedSongId] = createSignal<number | null>(null);
  const [hasInitialized, setHasInitialized] = createSignal(false);

  createEffect(
    on(filteredItems, (items) => {
      if (hasInitialized() || items.length === 0) return;

      const firstSong = items[0];
      if (firstSong) {
        setSelectedIndex(0);
        setSelectedSongId(firstSong.songId);
        setHasInitialized(true);
      }
    }),
  );

  createEffect(
    on(filteredItems, (items) => {
      if (!hasInitialized()) return;

      if (items.length === 0) return;

      const currentId = selectedSongId();
      if (currentId !== null) {
        const newIndex = items.findIndex((s) => s.songId === currentId);
        if (newIndex !== -1) {
          setSelectedIndex(newIndex);
          scrollToIndex(newIndex, false);
          return;
        }
      }

      setSelectedIndex(0);
      const firstSong = items[0];
      if (firstSong) {
        setSelectedSongId(firstSong.songId);
      }
    }),
  );

  createEffect(
    on(selectedIndex, (index) => {
      if (!hasInitialized()) return;

      const item = filteredItems()[index];
      if (item) {
        setSelectedSongId(item.songId);
      }
    }),
  );

  const selectedSong = createMemo(() => filteredItems()[selectedIndex()] ?? null);

  const gridNavigate = (direction: "up" | "down" | "left" | "right") => {
    const items = filteredItems();
    if (items.length === 0) return;

    const current = selectedIndex();
    let newIndex = current;

    switch (direction) {
      case "left":
        if (current % COLUMNS > 0) newIndex = current - 1;
        break;
      case "right":
        if (current % COLUMNS < COLUMNS - 1 && current + 1 < items.length) newIndex = current + 1;
        break;
      case "up":
        if (current >= COLUMNS) newIndex = current - COLUMNS;
        break;
      case "down":
        if (current + COLUMNS < items.length) newIndex = current + COLUMNS;
        break;
    }

    if (newIndex !== current) {
      setSelectedIndex(newIndex);
      playSound("select");
      scrollToIndex(newIndex);
    }
  };

  const scrollToIndex = (index: number, smooth = true) => {
    const rowIndex = Math.floor(index / COLUMNS);
    const scrollEl = containerRef;
    if (!scrollEl) return;

    const rowStart = rowIndex * rowHeight() + VERTICAL_PADDING;
    const rowEnd = rowStart + rowHeight();
    const viewportTop = scrollEl.scrollTop;
    const viewportBottom = viewportTop + scrollEl.clientHeight;

    let newScrollTop: number | null = null;

    if (rowStart < viewportTop + SCROLL_PADDING) {
      newScrollTop = rowStart - SCROLL_PADDING;
    } else if (rowEnd > viewportBottom - SCROLL_PADDING) {
      newScrollTop = rowEnd - scrollEl.clientHeight + SCROLL_PADDING;
    }

    if (newScrollTop !== null) {
      scrollEl.scrollTo({
        top: Math.max(0, newScrollTop),
        behavior: smooth ? "smooth" : "auto",
      });
    }
  };

  const onBack = () => {
    if (searchQuery().trim()) {
      setSearchQuery("");
      playSound("confirm");
      return;
    }
    playSound("confirm");
    navigate({ to: "/sing" });
  };

  const onPlay = async () => {
    const song = selectedSong();
    if (!song || startingGame()) return;

    const microphones = settingsStore.microphones();
    if (microphones.length === 0) {
      notify({ message: "No microphones configured", intent: "error" });
      return;
    }

    setStartingGame(true);
    playSound("confirm");

    try {
      const result = await commands.usdbGetSong(song.songId);

      if (result.status !== "ok") {
        notify({ message: "Failed to load song data", intent: "error" });
        setStartingGame(false);
        return;
      }

      const usdbSong = result.data;

      const firstMic = microphones[0];
      if (!firstMic) {
        setStartingGame(false);
        return;
      }

      roundActions.startRound({
        songs: [
          {
            song: usdbSong,
            players: [
              {
                player: { id: "guest", username: "Guest", type: "guest" },
                voice: 0,
                microphone: firstMic,
              },
            ],
            mode: "regular",
          },
        ],
      });
    } catch (error) {
      console.error("Failed to start online song:", error);
      notify({ message: "Failed to start song", intent: "error" });
      setStartingGame(false);
    }
  };

  const moveSorting = (direction: "left" | "right") => {
    const SORT_OPTIONS = ONLINE_SORT_OPTIONS;
    const currentIndex = SORT_OPTIONS.indexOf(sort());
    const newIndex = (currentIndex + (direction === "left" ? -1 : 1) + SORT_OPTIONS.length) % SORT_OPTIONS.length;
    setSort(SORT_OPTIONS[newIndex] || "artist");
  };

  // oxlint-disable-next-line solid/reactivity
  const throttledNavigate = throttle((direction: "left" | "right" | "up" | "down") => gridNavigate(direction), 100);

  useNavigation({
    onKeydown(event) {
      if (event.action === "back") {
        onBack();
      } else if (event.action === "left") {
        gridNavigate("left");
      } else if (event.action === "right") {
        gridNavigate("right");
      } else if (event.action === "up") {
        gridNavigate("up");
      } else if (event.action === "down") {
        gridNavigate("down");
      } else if (event.action === "search") {
        setSearchPopupOpen(!searchPopupOpen());
        playSound("select");
      } else if (event.action === "sort-left") {
        moveSorting("left");
        playSound("select");
      } else if (event.action === "sort-right") {
        moveSorting("right");
        playSound("select");
      }
    },
    onRepeat(event) {
      if (event.action === "left") throttledNavigate("left");
      else if (event.action === "right") throttledNavigate("right");
      else if (event.action === "up") throttledNavigate("up");
      else if (event.action === "down") throttledNavigate("down");
    },
    onKeyup(event) {
      if (event.action === "confirm") {
        onPlay();
      }
    },
  });

  return (
    <Layout
      intent="secondary"
      header={
        <div class="flex items-center justify-between gap-20">
          <div class="flex items-center gap-20">
            <TitleBar title={t("online.title")} onBack={onBack} />
            <div class="relative flex items-center gap-4">
              <SearchButton
                searchQuery={searchQuery()}
                searchFilter={searchFilter()}
                onClick={() => setSearchPopupOpen(true)}
              />

              <Show when={searchPopupOpen()}>
                <SearchPopup
                  searchQuery={searchQuery()}
                  searchFilter={searchFilter()}
                  onSearchQuery={setSearchQuery}
                  onSearchFilter={setSearchFilter}
                  onClose={() => setSearchPopupOpen(false)}
                />
              </Show>

              <div class="flex items-center gap-2 text-sm opacity-80">
                <IconMusic />
                <Show
                  when={filteredSongCount() !== usdbStore.catalog().length}
                  fallback={<span>{t("online.songsCached", { count: usdbStore.catalog().length })}</span>}
                >
                  <span>
                    {t("sing.songCount.filtered", {
                      filtered: filteredSongCount(),
                      total: usdbStore.catalog().length,
                    })}
                  </span>
                </Show>
              </div>

            </div>
          </div>

        </div>
      }
      footer={
        <div class="flex justify-between">
          <KeyHints hints={["back", "navigate", "confirm"]} />
          <SortSelect selected={sort()} onSelect={setSort} options={ONLINE_SORT_OPTIONS} />
        </div>
      }
    >
        <div class="relative flex h-full min-h-0 gap-8">
          <div class="relative -ml-8 w-1/2">
            <div ref={containerRef} class="styled-scrollbars absolute inset-0 overflow-y-auto">
              <Show
                when={filteredItems().length > 0}
                fallback={
                  <div class="flex h-full items-center justify-center">
                    <Show when={searchQuery().trim()}>
                      <p class="text-lg opacity-60">{t("online.noResults")}</p>
                    </Show>
                  </div>
                }
              >
              <div
                class="relative w-full"
                style={{ height: `${virtualizer.getTotalSize() + VERTICAL_PADDING * 2}px` }}
              >
              <For each={virtualizer.getVirtualItems()}>
                {(virtualRow) => {
                  const rowItems = () => rows()[virtualRow.index] ?? [];
                  const baseIndex = () => virtualRow.index * COLUMNS;

                  return (
                    <div
                      class="absolute top-0 left-0 grid w-full grid-cols-5 gap-3 px-4"
                      style={{ transform: `translateY(${virtualRow.start + VERTICAL_PADDING}px)` }}
                    >
                      <For each={rowItems()}>
                        {(song, colIndex) => {
                          const itemIndex = () => baseIndex() + colIndex();
                          return (
                            <div
                              onMouseEnter={() => setSelectedIndex(itemIndex())}
                              onClick={() => {
                                setSelectedIndex(itemIndex());
                                onPlay();
                              }}
                            >
                              <OnlineSongCard song={song} selected={selectedIndex() === itemIndex()} />
                            </div>
                          );
                        }}
                      </For>
                    </div>
                  );
                }}
              </For>
            </div>
            </Show>
          </div>
          </div>

          <div class="flex w-1/2 flex-col">
            <Show when={selectedSong()}>
              {(song) => (
                <>
                  <div class="flex h-1/3 items-center">
                    <div class="relative flex flex-col gap-3">
                      <div>
                        <p class="text-xl">{song().artist}</p>
                        <div class="max-w-full">
                          <span class="gradient-sing bg-linear-to-b bg-clip-text text-6xl font-bold text-transparent">
                            {song().title}
                          </span>
                        </div>
                      </div>

                      <div class="flex flex-wrap gap-2">
                        <Show when={song().year}>
                          <Badge label={String(song().year)} />
                        </Show>
                        <Show when={song().language}>
                          <Badge label={song().language} />
                        </Show>
                        <Show when={song().genre}>
                          <Badge label={song().genre} />
                        </Show>
                        <Show when={song().creator}>
                          <Badge label={`${t("online.by")} ${song().creator}`} />
                        </Show>
                        <Show when={song().goldenNotes}>
                          <span class="rounded-full bg-yellow-500/20 px-2.5 py-0.5 text-xs text-yellow-300">
                            {t("online.goldenNotes")}
                          </span>
                        </Show>
                      </div>

                      <div class="flex items-center gap-2">
                        <RatingStars rating={song().rating} />
                      </div>
                    </div>
                  </div>
                </>
              )}
            </Show>
          </div>
        </div>
    </Layout>
  );
}

interface OnlineSongCardProps {
  song: UsdbSearchEntry;
  selected?: boolean;
}

function OnlineSongCard(props: OnlineSongCardProps) {
  const [showCover, setShowCover] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  onMount(() => {
    timer = setTimeout(() => setShowCover(true), 150);
  });

  onCleanup(() => clearTimeout(timer));

  return (
    <div
      class="relative aspect-square w-full cursor-pointer overflow-hidden rounded-lg shadow-md transition-all duration-150 active:scale-95"
      classList={{ "scale-105 ring-4 ring-white": props.selected }}
    >
      <Show
        when={showCover() && props.song.coverUrl}
        fallback={
          <div class="flex h-full w-full items-center justify-center bg-white/5">
            <IconGlobe class="text-3xl opacity-20" />
          </div>
        }
      >
        {(url) => <img class="h-full w-full object-cover" src={url()} alt={props.song.title} />}
      </Show>
      <div class="absolute inset-0 -z-1 bg-black" />
    </div>
  );
}

function Badge(props: { label: string }) {
  return <span class="rounded-full bg-white/10 px-2.5 py-0.5 text-xs backdrop-blur-sm">{props.label}</span>;
}

function FilledStar() {
  return (
    <svg class="h-3 w-3 fill-current" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function HalfStar() {
  return (
    <svg class="h-3 w-3" viewBox="0 0 24 24">
      <defs>
        <linearGradient id="half">
          <stop offset="50%" stop-color="currentColor" />
          <stop offset="50%" stop-color="currentColor" stop-opacity="0.2" />
        </linearGradient>
      </defs>
      <path
        fill="url(#half)"
        d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
      />
    </svg>
  );
}

function EmptyStar() {
  return (
    <svg class="h-3 w-3 fill-current opacity-20" viewBox="0 0 24 24">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

function RatingStars(props: { rating: number }) {
  const fullStars = () => Math.floor(props.rating);
  const hasHalf = () => props.rating % 1 >= 0.25;
  const emptyStars = () => 5 - fullStars() - (hasHalf() ? 1 : 0);

  return (
    <div class="flex items-center gap-0.5 text-yellow-400">
      <For each={Array.from({ length: fullStars() })}>{() => <FilledStar />}</For>
      <Show when={hasHalf()}>
        <HalfStar />
      </Show>
      <For each={Array.from({ length: emptyStars() })}>{() => <EmptyStar />}</For>
    </div>
  );
}
