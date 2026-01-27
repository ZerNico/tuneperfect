import { useQuery } from "@tanstack/solid-query";
import { createFileRoute, Link } from "@tanstack/solid-router";
import type { SongSummary } from "@tuneperfect/contracts/game";
import { createEffect, createMemo, createSignal, For, Match, on, onCleanup, Show, Switch } from "solid-js";
import Button from "~/components/ui/button";
import { sessionQueryOptions } from "~/lib/auth";
import { t } from "~/lib/i18n";
import { startConnection, stopConnection, webrtcStore } from "~/stores/webrtc";
import IconChevronLeft from "~icons/lucide/chevron-left";
import IconLoaderCircle from "~icons/lucide/loader-circle";
import IconMusic from "~icons/lucide/music";
import IconSearch from "~icons/lucide/search";
import IconWifiOff from "~icons/lucide/wifi-off";

export const Route = createFileRoute("/_auth/_lobby/songs")({
  component: SongsComponent,
});

function SongsComponent() {
  const session = useQuery(() => sessionQueryOptions());
  const [searchQuery, setSearchQuery] = createSignal("");
  const [songs, setSongs] = createSignal<SongSummary[]>([]);
  const [isLoadingSongs, setIsLoadingSongs] = createSignal(false);

  // Track if component is still mounted for async cancellation
  let isMounted = true;
  onCleanup(() => {
    isMounted = false;
  });

  // Fetch songs when game client becomes available
  createEffect(
    on(
      () => webrtcStore.gameClient(),
      async (client) => {
        if (client) {
          setIsLoadingSongs(true);
          try {
            const songList = await client.songs.list();
            // Only update state if still mounted (prevents stale updates on navigation)
            if (isMounted) {
              setSongs(songList);
            }
          } catch (error) {
            // Only log if still mounted (otherwise this is expected on navigation)
            if (isMounted) {
              console.error("[Songs] Failed to fetch songs:", error);
            }
          } finally {
            if (isMounted) {
              setIsLoadingSongs(false);
            }
          }
        } else {
          if (isMounted) {
            setSongs([]);
          }
        }
      },
    ),
  );

  // Filter songs based on search query
  const filteredSongs = createMemo(() => {
    const query = searchQuery().toLowerCase().trim();
    if (!query) return songs();

    return songs().filter(
      (song) => song.title.toLowerCase().includes(query) || song.artist.toLowerCase().includes(query),
    );
  });

  const handleRetry = () => {
    const userId = session.data?.id;
    if (userId) {
      stopConnection();
      startConnection(userId);
    }
  };

  const isConnecting = () => webrtcStore.isConnecting() || webrtcStore.connectionState() === "connecting";
  const isConnected = () => webrtcStore.connectionState() === "connected";
  const hasFailed = () => webrtcStore.connectionState() === "failed" || webrtcStore.error();

  return (
    <div class="container mx-auto flex w-full flex-grow flex-col p-4 sm:max-w-4xl">
      <div class="mb-6">
        <Link to="/" class="mb-2 flex items-center gap-1 text-white/70 transition-colors hover:text-white">
          <IconChevronLeft class="h-5 w-5" />
          <span class="text-sm">{t("lobby.title")}</span>
        </Link>
        <h1 class="font-bold text-3xl">{t("songs.title")}</h1>
      </div>

      <Switch>
        {/* Connecting state */}
        <Match when={isConnecting()}>
          <div class="flex flex-grow flex-col items-center justify-center gap-4 py-12">
            <IconLoaderCircle class="h-12 w-12 animate-spin text-blue-500" />
            <p class="text-slate-600">{t("songs.connecting")}</p>
          </div>
        </Match>

        {/* Failed/disconnected state */}
        <Match when={hasFailed()}>
          <div class="flex flex-grow flex-col items-center justify-center gap-4 py-12">
            <IconWifiOff class="h-12 w-12 text-red-500" />
            <p class="text-slate-600">{t("songs.connectionFailed")}</p>
            <Show when={webrtcStore.error()}>
              <p class="text-red-500 text-sm">{webrtcStore.error()}</p>
            </Show>
            <Button intent="gradient" onClick={handleRetry}>
              {t("songs.retry")}
            </Button>
          </div>
        </Match>

        {/* Connected state */}
        <Match when={isConnected()}>
          <Show
            when={!isLoadingSongs()}
            fallback={
              <div class="flex flex-grow flex-col items-center justify-center gap-4 py-12">
                <IconLoaderCircle class="h-12 w-12 animate-spin text-blue-500" />
                <p class="text-slate-600">Loading songs...</p>
              </div>
            }
          >
            <Show
              when={songs().length > 0}
              fallback={
                <div class="flex flex-grow flex-col items-center justify-center gap-2 py-12">
                  <IconMusic class="h-12 w-12 text-slate-400" />
                  <h3 class="font-medium text-slate-900">{t("songs.noSongs")}</h3>
                  <p class="text-slate-500 text-sm">{t("songs.noSongsDescription")}</p>
                </div>
              }
            >
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
          </Show>
        </Match>

        {/* Initial/new state - show connecting UI */}
        <Match when={webrtcStore.connectionState() === "new"}>
          <div class="flex flex-grow flex-col items-center justify-center gap-4 py-12">
            <IconLoaderCircle class="h-12 w-12 animate-spin text-blue-500" />
            <p class="text-slate-600">{t("songs.connecting")}</p>
          </div>
        </Match>
      </Switch>
    </div>
  );
}
