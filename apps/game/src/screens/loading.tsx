import { useNavigate, getRouteApi } from "@tanstack/solid-router";
import { createMemo, createSignal, onMount } from "solid-js";

import Layout from "~/components/layout";
import LoadingPanel from "~/components/loading-panel";
import { t } from "~/lib/i18n";
import { native } from "~/lib/native/client";
import type { ParseSongsEvent } from "~/lib/native/contract";
import { tryCatch } from "~/lib/utils/try-catch";
import { songsStore } from "~/stores/songs";

const route = getRouteApi("/loading");

export default function LoadingScreen() {
  const navigate = useNavigate();
  const search = route.useSearch();
  const [currentSong, setCurrentSong] = createSignal("");
  const [currentSongs, setCurrentSongs] = createSignal(0);
  const [totalSongs, setTotalSongs] = createSignal(0);

  const onProgress = (event: ParseSongsEvent) => {
    if (event.type === "start") {
      setTotalSongs(event.total);
    } else if (event.type === "progress") {
      setCurrentSongs((currentSongs) => currentSongs + 1);
      // Just the file name: the folders are the same for every song and push it out of view.
      setCurrentSong(
        event.song
          .split(/[\\/]/)
          .pop()
          ?.replace(/\.[^.]+$/, "") ?? event.song,
      );
    }
  };

  onMount(async () => {
    const [_error, songPathArgs] = await tryCatch(native.app.songPaths());

    await songsStore.updateLocalSongs(songPathArgs ?? songsStore.paths(), onProgress);

    navigate({
      to: search().redirect,
    });
  });

  const progress = createMemo(() => (totalSongs() === 0 ? null : (currentSongs() / totalSongs()) * 100));

  return (
    <Layout>
      <div class="flex grow items-center justify-center p-4">
        <LoadingPanel
          title={t("loading.title")}
          progress={progress()}
          count={totalSongs() > 0 ? `${currentSongs()} / ${totalSongs()}` : undefined}
          detail={currentSong()}
        />
      </div>
    </Layout>
  );
}
