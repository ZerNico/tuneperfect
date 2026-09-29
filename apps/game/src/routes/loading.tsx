import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createMemo, createSignal, onMount } from "solid-js";
import * as v from "valibot";

import Layout from "~/components/layout";
import SummoningCircle from "~/components/summoning-circle";
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
      <div class="flex grow flex-col items-center justify-center gap-10 p-4">
        <SummoningCircle progress={progress()} class="h-[45cqh]" />

        <div class="flex w-full max-w-200 flex-col items-center gap-2 text-sm">
          <div class="flex items-baseline gap-3 font-black tracking-[0.3em] uppercase">
            <span>{t("loading.parsing")}</span>
            <span class="text-2xl tabular-nums">{progress().toString().padStart(3, "0")}%</span>
          </div>
          <span
            class="max-w-full min-w-0 truncate text-white/60"
            style={{ direction: "rtl", "unicode-bidi": "plaintext" }}
          >
            {currentSong() || "..."}
          </span>
        </div>
      </div>
    </Layout>
  );
}
