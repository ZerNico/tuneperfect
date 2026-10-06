import { debounce } from "@solid-primitives/scheduled";
import { useNavigate } from "@tanstack/solid-router";
import { createEffect, createMemo, createSignal, on, onCleanup, Show } from "solid-js";
import IconF1Key from "~icons/sing/f1-key";
import IconGamepadRT from "~icons/sing/gamepad-rt";
import IconShiftKey from "~icons/sing/shift-key";

import SongPlayer from "~/components/song-player";
import { DebouncedHighscoreList } from "~/components/song-select/debounced-highscore-list";
import { MedleyList } from "~/components/song-select/medley-list";
import { createSongBrowserState, SongBrowser } from "~/components/song-select/song-browser";
import KeyGlyph from "~/components/ui/key-glyph";
import { keyMode, useNavigation } from "~/hooks/navigation";
import { isDuet } from "~/hooks/use-song-filter";
import { t } from "~/lib/i18n";
import { playSound } from "~/lib/sound";
import type { LocalSong } from "~/lib/ultrastar/song";
import { toShuffled } from "~/lib/utils/array";
import { firstFacetValue } from "~/lib/utils/song-facets";
import { localStore } from "~/stores/local";
import { medleyStore } from "~/stores/medley";
import { selectionStore } from "~/stores/selection";
import { settingsStore } from "~/stores/settings";
import { songsStore } from "~/stores/songs";
import { usdbStore } from "~/stores/usdb";

// Module level: search, filters, sort and the selected song survive leaving the screen.
const browserState = createSongBrowserState("artist");
const [currentSong, setCurrentSong] = createSignal<LocalSong | null>(null);

const describeSong = (song: LocalSong) => ({
  id: song.hash,
  artist: song.artist,
  title: song.title,
  meta: [song.year?.toString(), firstFacetValue(song.genre), firstFacetValue(song.language)].filter(
    (value): value is string => !!value,
  ),
  duet: isDuet(song),
  isNew: !localStore.isSongPlayed(song.hash),
});

export default function SingScreen() {
  const navigate = useNavigate();
  // Double-buffered preview player — two persistent SongPlayer instances that crossfade
  const [slotASong, setSlotASong] = createSignal<LocalSong | null>(currentSong());
  const [slotBSong, setSlotBSong] = createSignal<LocalSong | null>(null);
  const [activeSlot, setActiveSlot] = createSignal<"a" | "b">("a");
  let cleanupTimeout: ReturnType<typeof setTimeout> | undefined;
  let pendingSwap = false;

  const clearActiveSlot = () => {
    clearTimeout(cleanupTimeout);
    if (activeSlot() === "a") setSlotASong(null);
    else setSlotBSong(null);
  };

  const swapToSong = (song: LocalSong | null) => {
    const current = activeSlot();
    const playing = current === "a" ? slotASong() : slotBSong();
    // Already playing it (e.g. the first selection on entry): swapping would restart the song.
    if (song && playing?.hash === song.hash) return;

    clearTimeout(cleanupTimeout);

    const next = current === "a" ? "b" : "a";

    if (next === "a") setSlotASong(song);
    else setSlotBSong(song);

    setActiveSlot(next);

    cleanupTimeout = setTimeout(() => {
      if (current === "a") setSlotASong(null);
      else setSlotBSong(null);
    }, 600);
  };

  onCleanup(() => clearTimeout(cleanupTimeout));

  // oxlint-disable-next-line solid/reactivity
  const debouncedSwap = debounce((song: LocalSong | null) => {
    pendingSwap = false;
    swapToSong(song);
  }, 200);

  createEffect(
    on(currentSong, (song) => {
      // Still scrolling: stop the old preview right away instead of letting it play on.
      if (pendingSwap) {
        clearActiveSlot();
      }
      pendingSwap = true;
      debouncedSwap(song);
    }),
  );

  const isMedley = createMemo(() => medleyStore.songs().length > 0);

  const startRegular = (song: LocalSong) => {
    playSound("confirm");
    selectionStore.set([song], "single");
    navigate({ to: "/sing/select" });
  };

  const startMedley = () => {
    playSound("confirm");
    selectionStore.set(medleyStore.songs(), "medley");
    navigate({ to: "/sing/select" });
  };

  /** Five random solo songs, replacing any queued medley. */
  const startRandomMedley = () => {
    const pool = songsStore.songs().filter((song) => !isDuet(song));
    if (pool.length === 0) return;

    const count = 5;
    // Without duplicates when the library allows it.
    const picked =
      pool.length >= count
        ? toShuffled(pool).slice(0, count)
        : Array.from({ length: count }, () => pool[Math.floor(Math.random() * pool.length)]!);

    playSound("confirm");
    selectionStore.set(picked, "medley");
    navigate({ to: "/sing/select" });
  };

  const addCurrentToMedley = () => {
    const song = currentSong();
    if (song) {
      medleyStore.add(song);
      playSound("select");
    }
  };

  // Library-only actions; search, filters, sort, random and confirm live in SongBrowser.
  useNavigation({
    actions: {
      "add-to-medley": addCurrentToMedley,
      "start-random-medley": startRandomMedley,
    },
  });

  const medleyList = (alternativeNavigation: boolean) => (
    <Show when={isMedley()}>
      <MedleyList
        songs={medleyStore.songs()}
        onRemove={(index) => {
          medleyStore.removeAt(index);
          playSound("select");
        }}
        onStart={startMedley}
        useAlternativeNavigation={alternativeNavigation}
      />
    </Show>
  );

  return (
    <SongBrowser
      title={t("sing.songs")}
      state={browserState}
      items={songsStore.songs()}
      getId={(song) => song.hash}
      describe={describeSong}
      coverOf={(song) => song.coverUrl}
      searchIndex={songsStore.searchIndex}
      sortOptions={["artist", "title", "year", "date"]}
      countLabel={(filtered, total) =>
        filtered !== total
          ? t("sing.songCount.filtered", { filtered, total })
          : total === 1
            ? t("sing.songCount.one", { count: total })
            : t("sing.songCount.other", { count: total })
      }
      onBack={() => navigate({ to: "/home" })}
      onConfirm={(song) => (isMedley() ? startMedley() : startRegular(song))}
      onSelectedChange={setCurrentSong}
      menuItems={[
        {
          label: t("sing.menu.addToMedley"),
          hint: <KeyGlyph keyboard={IconF1Key} gamepad={IconGamepadRT} />,
          action: addCurrentToMedley,
        },
        {
          label: t("sing.menu.startRandomMedley"),
          hint: (
            <Show when={keyMode() === "keyboard"}>
              <IconShiftKey />
              <span class="text-xs font-bold">+ D</span>
            </Show>
          ),
          action: startRandomMedley,
        },
        ...(usdbStore.loggedIn()
          ? [
              {
                label: t("sing.menu.searchUsdb"),
                action: () => {
                  playSound("confirm");
                  navigate({ to: "/sing/online-loading" });
                },
              },
            ]
          : []),
      ]}
      side={(song, view) => (
        <>
          <Show when={song()}>{(song) => <DebouncedHighscoreList songHash={song().hash} />}</Show>
          {/* In the grid, up/down move through covers, so the medley list uses other keys. */}
          {medleyList(view === "grid")}
        </>
      )}
      background={
        <div class="relative h-full w-full">
          <div
            class="absolute inset-0 z-1 transition-opacity duration-500"
            style={{ opacity: activeSlot() === "a" && slotASong() ? 1 : 0 }}
          >
            <SongPlayer
              mode="preview"
              volume={settingsStore.getVolume("preview")}
              class="h-full w-full opacity-60"
              playing={activeSlot() === "a" && !!slotASong()}
              song={slotASong()}
            />
          </div>
          <div
            class="absolute inset-0 z-1 transition-opacity duration-500"
            style={{ opacity: activeSlot() === "b" && slotBSong() ? 1 : 0 }}
          >
            <SongPlayer
              mode="preview"
              volume={settingsStore.getVolume("preview")}
              class="h-full w-full opacity-60"
              playing={activeSlot() === "b" && !!slotBSong()}
              song={slotBSong()}
            />
          </div>
        </div>
      }
    />
  );
}
