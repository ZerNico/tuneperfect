import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import type { Event } from "@tauri-apps/api/event";
import { getMatches } from "@tauri-apps/plugin-cli";
import { createMemo, createSignal, onCleanup, onMount } from "solid-js";
import * as v from "valibot";
import { events, type ProgressEvent, type StartParsingEvent } from "~/bindings";
import Layout from "~/components/layout";
import { t } from "~/lib/i18n";
import { tryCatch } from "~/lib/utils/try-catch";
import { songsStore } from "~/stores/songs";
import IconLoaderCircle from "~icons/lucide/loader-circle";

export const Route = createFileRoute("/loading")({
  component: LoadingComponent,
  validateSearch: v.object({
    redirect: v.string(),
  }),
});

function LoadingComponent() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [currentSong, setCurrentSong] = createSignal("");
  const [currentSongs, setCurrentSongs] = createSignal(0);
  const [totalSongs, setTotalSongs] = createSignal(0);

  onMount(async () => {
    const [_error, matches] = await tryCatch(getMatches());

    console.log('jep');

    if (matches?.args.songpath && Array.isArray(matches.args.songpath.value)) {
      await songsStore.updateLocalSongs(matches.args.songpath.value);
    } else {
      await songsStore.updateLocalSongs(songsStore.paths());
    }

    navigate({
      to: search().redirect,
    });
  });

  const onProgress = (event: Event<ProgressEvent>) => {
    setCurrentSongs((currentSongs) => currentSongs + 1);
    setCurrentSong(event.payload.song);
  };

  const onStartParsing = (event: Event<StartParsingEvent>) => {
    setTotalSongs(event.payload.total_songs);
  };

  onMount(() => {
    const unlistenProgress = events.progressEvent.listen(onProgress);
    const unlistenStartParsing = events.startParsingEvent.listen(onStartParsing);

    onCleanup(async () => {
      (await unlistenProgress)();
      (await unlistenStartParsing)();
    });
  });

  const progress = createMemo(() => {
    if (totalSongs() === 0) {
      return 0;
    }

    return Math.round((currentSongs() / totalSongs()) * 100);
  });

  return (
    <Layout>
      <div class="flex flex-grow flex-col items-center justify-center gap-8 p-4">
        <div class="flex items-center justify-center">
          <IconLoaderCircle class="animate-spin text-6xl" />
        </div>

        <div class="w-full max-w-200">
          <div class="mb-2 flex justify-between text-sm">
            <div class="flex min-w-0 flex-1 items-center">
              <span class="flex-shrink-0">{t("loading.parsing")}&nbsp;</span>
              <span class="min-w-0 truncate text-left" style="direction: rtl; unicode-bidi: plaintext;">{currentSong() || "..."}</span>
            </div>
            <span class="ml-2 flex-shrink-0">{progress()}%</span>
          </div>

          <div class="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
            <div class="h-full rounded-full bg-white" style={{ width: `${progress()}%` }} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
