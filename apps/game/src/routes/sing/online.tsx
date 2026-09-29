import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import IconStar from "~icons/ph/star-fill";
import IconStarHalf from "~icons/ph/star-half-fill";

import { createSongBrowserState, SongBrowser } from "~/components/song-select/song-browser";
import type { SongInfo } from "~/components/song-select/song-title";
import type { SortOption } from "~/hooks/use-song-filter";
import { t } from "~/lib/i18n";
import { native, safe } from "~/lib/native/client";
import { playSound } from "~/lib/sound";
import { notify } from "~/lib/toast";
import { selectionStore } from "~/stores/selection";
import { type UsdbSearchEntry, usdbStore } from "~/stores/usdb";

export const Route = createFileRoute("/sing/online")({
  component: OnlineSearchComponent,
});

const ONLINE_SORT_OPTIONS: SortOption[] = ["views", "artist", "title", "year"];

/** Genre fields are often comma lists ("Pop, Dance-Pop, …"); the first entry is enough. */
const firstOf = (value: string) => value.split(",")[0]?.trim();

const describeEntry = (entry: UsdbSearchEntry): SongInfo => ({
  id: String(entry.songId),
  artist: entry.artist,
  title: entry.title,
  meta: [
    entry.year?.toString(),
    firstOf(entry.genre),
    firstOf(entry.language),
    entry.creator ? `${t("online.by")} ${entry.creator}` : undefined,
  ].filter((value): value is string => !!value),
  duet: false,
  isNew: false,
  extras: (
    <>
      <Show when={entry.goldenNotes}>
        <span class="inline-block -skew-x-12 rounded-sm bg-yellow-400 px-2.5 py-0.5 text-sm font-black text-black uppercase shadow-md">
          <span class="inline-block skew-x-12">{t("online.goldenNotes")}</span>
        </span>
      </Show>
      <Show when={entry.rating}>{(rating) => <RatingStars rating={rating()} />}</Show>
    </>
  ),
});

function OnlineSearchComponent() {
  const navigate = useNavigate();
  const state = createSongBrowserState("views");
  const [startingGame, setStartingGame] = createSignal(false);
  const [selected, setSelected] = createSignal<UsdbSearchEntry | null>(null);

  const play = async (entry: UsdbSearchEntry) => {
    if (startingGame()) return;
    setStartingGame(true);
    playSound("confirm");

    const [error, usdbSong] = await safe(native.usdb.getSong({ songId: entry.songId }));
    if (error) {
      console.error("Failed to load online song:", error);
      notify({ message: t("online.loadFailed"), intent: "error" });
      setStartingGame(false);
      return;
    }

    selectionStore.set([usdbSong], "single");
    navigate({ to: "/sing/select" });
  };

  return (
    <SongBrowser
      title={t("online.title")}
      state={state}
      items={usdbStore.catalog()}
      getId={(entry) => String(entry.songId)}
      describe={describeEntry}
      coverOf={(entry) => entry.coverUrl}
      lazyCovers
      sortOptions={ONLINE_SORT_OPTIONS}
      filterOptions={{ idField: "songId", searchIndex: () => usdbStore.searchIndex(), showTypeFilter: false }}
      countLabel={(filtered, total) =>
        filtered !== total
          ? t("sing.songCount.filtered", { filtered, total })
          : t("online.songsCached", { count: total })
      }
      onBack={() => navigate({ to: "/sing" })}
      onConfirm={play}
      onSelectedChange={setSelected}
      background={
        <Show when={selected()?.coverUrl} keyed>
          {(url) => (
            // Blurred cover of the selected song; "hide" played in reverse fades it in.
            <div class="absolute inset-0 animate-[hide_0.4s_ease-out_reverse_both] overflow-hidden">
              <img class="h-full w-full scale-110 object-cover opacity-40 blur-2xl" src={url} alt="" />
            </div>
          )}
        </Show>
      }
    />
  );
}

function RatingStars(props: { rating: number }) {
  const full = () => Math.floor(props.rating);
  const half = () => props.rating % 1 >= 0.25;
  const empty = () => 5 - full() - (half() ? 1 : 0);

  return (
    <span class="inline-flex -skew-x-12 items-center rounded-sm bg-black/35 px-2.5 py-1 text-sm text-yellow-400 backdrop-blur-sm">
      <span class="inline-flex skew-x-12 items-center gap-0.5">
        <For each={Array.from({ length: full() })}>{() => <IconStar />}</For>
        <Show when={half()}>
          <IconStarHalf />
        </Show>
        <For each={Array.from({ length: Math.max(0, empty()) })}>{() => <IconStar class="text-white/25" />}</For>
      </span>
    </span>
  );
}
