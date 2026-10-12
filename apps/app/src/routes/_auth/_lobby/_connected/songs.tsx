import { useQuery } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import type { GameClient, SongSummary } from "@tuneperfect/webrtc/contracts/game";
import { createEffect, createMemo, createSignal, For, Loading, onSettled, Show } from "solid-js";
import IconArrowClockwise from "~icons/ph/arrow-clockwise-bold";
import IconMagnifyingGlass from "~icons/ph/magnifying-glass-bold";
import IconMusicNotes from "~icons/ph/music-notes-fill";
import IconX from "~icons/ph/x-bold";

import PageHeader from "~/components/page-header";
import SongCover from "~/components/song-cover";
import Button from "~/components/ui/button";
import { useGameClient } from "~/contexts/game-client";
import { useSongSearch } from "~/hooks/use-song-search";
import { songsQueryOptions } from "~/lib/game-query";
import { t } from "~/lib/i18n";
import { HEADER_HEIGHT, setStuckBarHeight } from "~/lib/top-bar";
import { createWindowVirtualizer } from "~/lib/virtual";

export const Route = createFileRoute("/_auth/_lobby/_connected/songs")({
  component: SongsComponent,
});

type SortOption = "artist" | "title" | "year" | "newest";
const SORT_OPTIONS: SortOption[] = ["artist", "title", "year", "newest"];
const SORT_STORAGE_KEY = "songs-sort";

const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

const byArtist = (a: SongSummary, b: SongSummary) =>
  collator.compare(a.artist, b.artist) || collator.compare(a.title, b.title);

/** Same orders as the game's song select; songs without a year or date go last. */
const COMPARE: Record<SortOption, (a: SongSummary, b: SongSummary) => number> = {
  artist: byArtist,
  title: (a, b) => collator.compare(a.title, b.title) || collator.compare(a.artist, b.artist),
  year: (a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity) || byArtist(a, b),
  newest: (a, b) => (b.addedAt ?? -Infinity) - (a.addedAt ?? -Infinity) || byArtist(a, b),
};

/** The game's song library; the game client comes from the connected layout. */
function SongsComponent() {
  const gameClient = useGameClient();
  const songsQuery = useQuery(() => songsQueryOptions(gameClient));

  const [searchQuery, setSearchQuery] = createSignal("");
  // Remembered on this phone across visits.
  const storedSort = localStorage.getItem(SORT_STORAGE_KEY) as SortOption | null;
  const [sort, setSortSignal] = createSignal<SortOption>(
    storedSort && SORT_OPTIONS.includes(storedSort) ? storedSort : "artist",
  );
  const setSort = (option: SortOption) => {
    setSortSignal(option);
    localStorage.setItem(SORT_STORAGE_KEY, option);
  };

  // While the search bar is stuck under the header, the header's backdrop grows to cover it (one layer,
  // no seam). A marker just above the bar leaves the area under the header exactly when the bar sticks.
  const [marker, setMarker] = createSignal<HTMLDivElement>();
  const [bar, setBar] = createSignal<HTMLDivElement>();
  const [stuck, setStuck] = createSignal(false);
  const [barHeight, setBarHeight] = createSignal(0);
  onSettled(() => {
    const markerElement = marker();
    const barElement = bar();
    if (!markerElement || !barElement) return;

    const intersection = new IntersectionObserver(([entry]) => setStuck(!!entry && !entry.isIntersecting), {
      rootMargin: `-${HEADER_HEIGHT}px 0px 0px 0px`,
    });
    intersection.observe(markerElement);
    // The sort chips hide while searching, so the bar's height changes.
    const resize = new ResizeObserver(() => setBarHeight(barElement.offsetHeight));
    resize.observe(barElement);

    return () => {
      intersection.disconnect();
      resize.disconnect();
      setStuckBarHeight(0);
    };
  });
  createEffect(() => (stuck() ? barHeight() : 0), setStuckBarHeight);

  return (
    <main class="mx-auto flex w-full max-w-md grow flex-col px-6 pt-4">
      <PageHeader
        back={{ to: "/", label: t("lobby.title") }}
        title={t("songs.title")}
        // Only once loaded: reading the list before would hold the whole page back.
        tag={songsQuery.isSuccess ? String(songsQuery.data.length) : undefined}
        action={
          <button
            type="button"
            aria-label={t("songs.refresh")}
            class="flex size-11 cursor-pointer items-center justify-center rounded-[12px] bg-white/8 text-xl transition-colors hover:bg-white/12 disabled:opacity-50"
            disabled={songsQuery.isFetching}
            onClick={() => void songsQuery.refetch()}
          >
            <IconArrowClockwise class={{ "animate-spin": songsQuery.isFetching }} />
          </button>
        }
      />

      <div ref={setMarker} aria-hidden="true" />
      <div ref={setBar} class="sticky top-16 z-6 flex flex-col gap-3 pt-1 pb-3">
        <label class="flex h-11 items-center gap-2 rounded-[12px] bg-white/8 px-3 focus-within:ring-2 focus-within:ring-white/40">
          <IconMagnifyingGlass class="shrink-0 text-white/45" />
          <input
            type="search"
            value={searchQuery()}
            onInput={(event) => setSearchQuery(event.currentTarget.value)}
            placeholder={t("songs.searchPlaceholder")}
            aria-label={t("songs.searchPlaceholder")}
            enterkeyhint="search"
            class="h-full min-w-0 grow bg-transparent text-white placeholder:text-white/45 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          <Show when={searchQuery()}>
            <button
              type="button"
              aria-label={t("songs.clearSearch")}
              class="-mr-1 flex size-8 cursor-pointer items-center justify-center rounded-[8px] text-white/60 hover:text-white"
              onClick={() => setSearchQuery("")}
            >
              <IconX />
            </button>
          </Show>
        </label>

        <Show when={!searchQuery()}>
          <div class="flex gap-1.5">
            <For each={SORT_OPTIONS}>
              {(option) => (
                <button
                  type="button"
                  aria-pressed={sort() === option ? "true" : "false"}
                  class={[
                    "cursor-pointer rounded-[8px] px-3 py-1.5 text-sm font-bold transition-colors",
                    {
                      "gradient-accent text-white": sort() === option,
                      "bg-white/7 text-white/60 hover:text-white": sort() !== option,
                    },
                  ]}
                  onClick={() => setSort(option)}
                >
                  {t(`songs.sort.${option}`)}
                </button>
              )}
            </For>
          </div>
        </Show>
      </div>

      <Show
        when={!songsQuery.isError}
        fallback={
          <div class="flex flex-col items-center gap-3 rounded-[12px] bg-white/7 px-4 py-6 text-center">
            <p class="text-white/70">{t("songs.loadFailed")}</p>
            <Button onClick={() => void songsQuery.refetch()}>{t("error.retry")}</Button>
          </div>
        }
      >
        {/* Its own boundary: the list suspends until the game sent it, the search bar stays usable. */}
        <Loading fallback={<SongListPlaceholder />}>
          <SongResults songs={songsQuery.data} sort={sort()} searchQuery={searchQuery()} client={gameClient} />
        </Loading>
      </Show>
    </main>
  );
}

/** The sorted or searched songs. Under the page's loading boundary, so it only sets up once the list is there. */
function SongResults(props: { songs: SongSummary[]; sort: SortOption; searchQuery: string; client: GameClient }) {
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh copy
  const sortedSongs = createMemo(() => [...props.songs].sort(COMPARE[props.sort]));
  // Searching ranks by relevance; browsing uses the chosen order.
  const { filteredSongs } = useSongSearch({ songs: sortedSongs, searchQuery: () => props.searchQuery });

  return (
    <Show
      when={filteredSongs().length > 0}
      fallback={
        <div class="flex flex-col items-center gap-2 py-12 text-center text-white/50">
          <IconMusicNotes class="text-4xl" />
          <Show when={props.songs.length} fallback={<p>{t("songs.noSongs")}</p>}>
            <p>{t("songs.noResults")}</p>
          </Show>
        </div>
      }
    >
      <SongList songs={filteredSongs()} client={props.client} />
    </Show>
  );
}

function SongListPlaceholder() {
  return (
    <div class="flex flex-col gap-1">
      <For each={[0, 1, 2, 3, 4, 5]}>{() => <div class="h-16 animate-pulse rounded-[12px] bg-white/6" />}</For>
    </div>
  );
}

/** Row height incl. the gap; fixed, so the list never needs measuring. */
const ROW_HEIGHT = 68;

/**
 * Only the rows near the screen exist (libraries can have tens of thousands of songs). Rows are keyed by
 * song, so a row never switches songs while scrolling and its cover loads for exactly that song.
 */
function SongList(props: { songs: SongSummary[]; client: GameClient }) {
  let list: HTMLUListElement | undefined;
  // Where the list starts in the page; the virtualizer works in page coordinates.
  const [offset, setOffset] = createSignal(0);

  const virtualizer = createWindowVirtualizer(() => ({
    count: props.songs.length,
    estimateSize: () => ROW_HEIGHT,
    overscan: 10,
    scrollMargin: offset(),
  }));

  const measureOffset = () => {
    if (list) setOffset(list.getBoundingClientRect().top + window.scrollY);
  };
  onSettled(() => {
    measureOffset();
    // Content above the list changes height (the sort chips hide while searching).
    const observer = new ResizeObserver(measureOffset);
    if (list?.parentElement) observer.observe(list.parentElement);
    return () => observer.disconnect();
  });

  const positions = createMemo(() => new Map(props.songs.map((song, index) => [song.hash, index])));
  const visible = createMemo(() =>
    virtualizer
      .items()
      .map((item) => props.songs[item.index]?.hash)
      .filter((hash): hash is string => !!hash),
  );

  return (
    <ul ref={list} class="relative mb-4" style={{ height: `${virtualizer.totalSize()}px` }}>
      <For each={visible()}>
        {(hash) => {
          const index = () => positions().get(hash) ?? 0;
          const song = () => props.songs[index()];
          return (
            <Show when={song()}>
              {(song) => (
                <li
                  class="absolute inset-x-0 flex h-16 items-center gap-3 rounded-[12px] bg-white/6 p-2"
                  style={{ top: `${index() * ROW_HEIGHT}px` }}
                >
                  <SongCover hash={hash} client={props.client} class="size-12 rounded-[8px]" />
                  <div class="flex min-w-0 grow flex-col">
                    <span class="truncate text-[16px] font-bold">{song().title}</span>
                    <span class="truncate text-sm text-white/55">{song().artist}</span>
                  </div>
                  <Show when={song().year}>
                    <span class="shrink-0 pr-1 text-sm text-white/40 tabular-nums">{song().year}</span>
                  </Show>
                </li>
              )}
            </Show>
          );
        }}
      </For>
    </ul>
  );
}
