import { createQuery } from "@tanstack/solid-query";
import { createFileRoute, Link } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import { useGameClient } from "~/contexts/game-client";
import { useSongSearch } from "~/hooks/use-song-search";
import { songsQueryOptions } from "~/lib/game-query";
import { t } from "~/lib/i18n";
import IconChevronLeft from "~icons/lucide/chevron-left";
import IconLoaderCircle from "~icons/lucide/loader-circle";
import IconMusic from "~icons/lucide/music";
import IconRefreshCw from "~icons/lucide/refresh-cw";
import IconSearch from "~icons/lucide/search";

export const Route = createFileRoute("/_auth/_lobby/_connected/songs")({
  component: SongsComponent,
});

/**
 * Songs page - displays the list of songs from the game client.
 * Game client is provided via context by the _connected layout.
 */
function SongsComponent() {
  const gameClient = useGameClient();
  const [searchQuery, setSearchQuery] = createSignal("");

  // Fetch songs using TanStack Query
  const songsQuery = createQuery(() => songsQueryOptions(gameClient));

  // Use MiniSearch for fuzzy, accent-insensitive search
  const { filteredSongs } = useSongSearch({
    songs: () => songsQuery.data ?? [],
    searchQuery,
  });

  const handleRefreshSongs = () => {
    songsQuery.refetch();
  };

  return (
    <div class="container mx-auto flex w-full flex-grow flex-col p-4 sm:max-w-4xl">
      <div class="mb-6 flex items-start justify-between">
        <div>
          <Link to="/" class="mb-2 flex items-center gap-1 text-white/70 transition-colors hover:text-white">
            <IconChevronLeft class="h-5 w-5" />
            <span class="text-sm">{t("lobby.title")}</span>
          </Link>
          <h1 class="font-bold text-3xl">{t("songs.title")}</h1>
        </div>

        {/* Refresh button */}
        <button
          type="button"
          onClick={handleRefreshSongs}
          disabled={songsQuery.isFetching}
          class="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 text-white transition-colors hover:bg-white/20 disabled:opacity-50"
        >
          <IconRefreshCw class={`h-5 w-5 ${songsQuery.isFetching ? "animate-spin" : ""}`} />
          <span class="sr-only">Refresh</span>
        </button>
      </div>

      {/* Loading state */}
      <Show when={songsQuery.isLoading}>
        <div class="flex flex-grow flex-col items-center justify-center gap-4 py-12">
          <IconLoaderCircle class="h-12 w-12 animate-spin text-blue-400" />
          <p class="text-white/70">Loading songs...</p>
        </div>
      </Show>

      {/* Empty state */}
      <Show when={!songsQuery.isLoading && (songsQuery.data?.length ?? 0) === 0}>
        <div class="flex flex-grow flex-col items-center justify-center gap-2 py-12">
          <IconMusic class="h-12 w-12 text-white/40" />
          <h3 class="font-medium text-white">{t("songs.noSongs")}</h3>
          <p class="text-white/60 text-sm">{t("songs.noSongsDescription")}</p>
        </div>
      </Show>

      {/* Songs list */}
      <Show when={!songsQuery.isLoading && (songsQuery.data?.length ?? 0) > 0}>
        {/* Search input */}
        <div class="relative mb-4">
          <IconSearch class="absolute top-1/2 left-3 h-5 w-5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder={t("songs.searchPlaceholder")}
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="w-full rounded-lg border border-slate-200 bg-white py-2 pr-4 pl-10 text-slate-800 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Song list */}
        <div class="flex flex-col gap-2">
          <For each={filteredSongs()}>
            {(song) => (
              <div class="rounded-lg bg-white p-4 shadow-sm">
                <div class="font-semibold text-slate-800">{song.title}</div>
                <div class="text-slate-500 text-sm">{song.artist}</div>
              </div>
            )}
          </For>
        </div>

        <Show when={filteredSongs().length === 0 && searchQuery()}>
          <div class="py-8 text-center text-slate-500">No songs match your search</div>
        </Show>
      </Show>
    </div>
  );
}
