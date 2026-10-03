import { createQuery } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import type { SongSummary } from "@tuneperfect/webrtc/contracts/game";
import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js";
import IconArrowClockwise from "~icons/ph/arrow-clockwise-bold";
import IconMagnifyingGlass from "~icons/ph/magnifying-glass-bold";
import IconMusicNotes from "~icons/ph/music-notes-fill";
import IconX from "~icons/ph/x-bold";

import PageHeader from "~/components/page-header";
import SongCover from "~/components/song-cover";
import { useGameClient } from "~/contexts/game-client";
import { useSongSearch } from "~/hooks/use-song-search";
import { songsQueryOptions } from "~/lib/game-query";
import { t } from "~/lib/i18n";

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
  const songsQuery = createQuery(() => songsQueryOptions(gameClient));

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

  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh copy
  const sortedSongs = createMemo(() => [...(songsQuery.data ?? [])].sort(COMPARE[sort()]));
  // The sticky search bar only gets a backdrop once the list scrolls under it; at rest it would cut a
  // hard edge into the background.
  const [scrolled, setScrolled] = createSignal(false);
  onMount(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    onCleanup(() => window.removeEventListener("scroll", onScroll));
  });

  // Searching ranks by relevance; browsing uses the chosen order.
  const { filteredSongs } = useSongSearch({ songs: sortedSongs, searchQuery });

  return (
    <main class="mx-auto flex w-full max-w-md grow flex-col px-6 pt-4">
      <PageHeader
        back={{ to: "/", label: t("lobby.title") }}
        title={t("songs.title")}
        tag={songsQuery.data ? String(songsQuery.data.length) : undefined}
        action={
          <button
            type="button"
            aria-label={t("songs.refresh")}
            class="flex size-10 cursor-pointer items-center justify-center rounded-[10px] bg-white/8 text-lg transition-colors hover:bg-white/12 disabled:opacity-50"
            disabled={songsQuery.isFetching}
            onClick={() => void songsQuery.refetch()}
          >
            <IconArrowClockwise classList={{ "animate-spin": songsQuery.isFetching }} />
          </button>
        }
      />

      <div
        class="sticky top-16 z-1 -mx-6 flex flex-col gap-3 px-6 pt-1 pb-3 transition-colors duration-200"
        classList={{ "bg-[rgb(16_16_36/0.85)] backdrop-blur-xl": scrolled() }}
      >
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
                  aria-pressed={sort() === option}
                  class="cursor-pointer rounded-[8px] px-3 py-1.5 text-sm font-bold transition-colors"
                  classList={{
                    "gradient-accent text-white": sort() === option,
                    "bg-white/7 text-white/60 hover:text-white": sort() !== option,
                  }}
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
        when={filteredSongs().length > 0}
        fallback={
          <div class="flex flex-col items-center gap-2 py-12 text-center text-white/50">
            <IconMusicNotes class="text-4xl" />
            <Show when={songsQuery.data?.length} fallback={<p>{t("songs.noSongs")}</p>}>
              <p>{t("songs.noResults")}</p>
            </Show>
          </div>
        }
      >
        <ul class="flex flex-col gap-1 pb-4">
          <For each={filteredSongs()}>
            {(song) => (
              <li class="flex items-center gap-3 rounded-[12px] bg-white/6 p-2">
                <SongCover hash={song.hash} client={gameClient} class="size-12 rounded-[8px]" />
                <div class="flex min-w-0 grow flex-col">
                  <span class="truncate text-[16px] font-bold">{song.title}</span>
                  <span class="truncate text-sm text-white/55">{song.artist}</span>
                </div>
                <Show when={song.year}>
                  <span class="shrink-0 pr-1 text-sm text-white/40 tabular-nums">{song.year}</span>
                </Show>
              </li>
            )}
          </For>
        </ul>
      </Show>
    </main>
  );
}
