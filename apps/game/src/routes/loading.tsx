import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createMemo, createSignal, onMount } from "solid-js";
import * as v from "valibot";
import IconLoaderCircle from "~icons/lucide/loader-circle";

import Layout from "~/components/layout";
import { t } from "~/lib/i18n";
import { native } from "~/lib/native/client";
import type { ParseSongsEvent } from "~/lib/native/contract";
import { tryCatch } from "~/lib/utils/try-catch";
import { songsStore } from "~/stores/songs";

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

  const onProgress = (event: ParseSongsEvent) => {
    if (event.type === "start") {
      setTotalSongs(event.total);
    } else if (event.type === "progress") {
      setCurrentSongs((currentSongs) => currentSongs + 1);
      setCurrentSong(event.song);
    }
  };

  onMount(async () => {
    const [_error, songPathArgs] = await tryCatch(native.app.songPaths());

    await songsStore.updateLocalSongs(songPathArgs ?? songsStore.paths(), onProgress);

    navigate({
      to: search().redirect,
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
      <div class="flex grow flex-col items-center justify-center gap-8 p-4">
        <div class="flex items-center justify-center">
          <IconLoaderCircle class="animate-spin text-6xl" />
        </div>

        <div class="w-full max-w-200">
          <div class="mb-2 flex justify-between text-sm">
            <div class="flex min-w-0 flex-1 items-center">
              <span class="shrink-0">{t("loading.parsing")}&nbsp;</span>
              <span class="min-w-0 truncate text-left" style={{ direction: "rtl", "unicode-bidi": "plaintext" }}>
                {currentSong() || "..."}
              </span>
            </div>
            <span class="ml-2 shrink-0">{progress()}%</span>
          </div>

          <div class="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
            <div class="h-full rounded-full bg-white" style={{ width: `${progress()}%` }} />
          </div>
        </div>
      </div>
    </Layout>
  );
}
