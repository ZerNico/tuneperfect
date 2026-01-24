import { debounce } from "@solid-primitives/scheduled";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createEffect, createMemo, createSignal, Match, on, Show, Switch } from "solid-js";
import { Motion, Presence } from "solid-motionone";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import SongPlayer from "~/components/song-player";
import { DebouncedHighscoreList } from "~/components/song-select/debounced-highscore-list";
import { MedleyList } from "~/components/song-select/medley-list";
import { MenuPopup } from "~/components/song-select/menu-popup";
import { SearchButton } from "~/components/song-select/search-button";
import { SearchPopup } from "~/components/song-select/search-popup";
import { SongCard } from "~/components/song-select/song-card";
import { SongGrid, type SongGridRef } from "~/components/song-select/song-grid";
import {
  type SearchFilter,
  SongScroller,
  type SongScrollerRef,
  type SortOption,
} from "~/components/song-select/song-scroller";
import { SortSelect } from "~/components/song-select/sort-select";
import TitleBar from "~/components/title-bar";
import { keyMode, useNavigation } from "~/hooks/navigation";
import { t } from "~/lib/i18n";
import { playSound } from "~/lib/sound";
import type { LocalSong } from "~/lib/ultrastar/song";
import { settingsStore } from "~/stores/settings";
import { songsStore } from "~/stores/songs";
import IconDices from "~icons/lucide/dices";
import IconMenu from "~icons/lucide/menu";
import IconMusic from "~icons/lucide/music";
import IconDuet from "~icons/sing/duet";
import IconF4Key from "~icons/sing/f4-key";
import IconGamepadX from "~icons/sing/gamepad-x";
import IconGamepadY from "~icons/sing/gamepad-y";
import IconTabKey from "~icons/sing/tab-key";

export const Route = createFileRoute("/sing/")({
  component: SingComponent,
});

// Module-level signals to preserve state across navigations
const [currentSong, setCurrentSong] = createSignal<LocalSong | null>(null);
const [searchQuery, setSearchQuery] = createSignal("");
const [searchFilter, setSearchFilter] = createSignal<SearchFilter>("all");
const [searchPopupOpen, setSearchPopupOpen] = createSignal(false);
const [menuOpen, setMenuOpen] = createSignal(false);
const [sort, setSort] = createSignal<SortOption>("artist");
const [filteredSongCount, setFilteredSongCount] = createSignal(0);
const [medleySongs, setMedleySongs] = createSignal<LocalSong[]>([]);

function SingComponent() {
  const navigate = useNavigate();
  const songs = createMemo(() => songsStore.songs());

  // Initialize current song if not set
  if (!currentSong()) {
    const firstSong = songs()[0];
    if (firstSong) {
      setCurrentSong(firstSong);
    }
  }

  // Debounced song for preview player - only updates after scrolling stops
  const [previewSong, setPreviewSong] = createSignal<LocalSong | null>(currentSong());
  const [isScrolling, setIsScrolling] = createSignal(false);

  const debouncedSetPreviewSong = debounce((song: LocalSong | null) => {
    setPreviewSong(song);
  }, 500);

  createEffect(
    on(currentSong, (song) => {
      if (isScrolling()) {
        // When scrolling fast, clear preview and debounce the new one
        setPreviewSong(null);
        debouncedSetPreviewSong(song);
      } else {
        // Single navigation - update immediately
        debouncedSetPreviewSong.clear();
        setPreviewSong(song);
      }
    }),
  );

  const isMedley = createMemo(() => medleySongs().length > 0);

  // Ref to control the song scroller/grid
  let scrollerRef: SongScrollerRef | undefined;
  let gridRef: SongGridRef | undefined;

  const songSelectStyle = () => settingsStore.general().songSelectStyle;

  const onBack = () => {
    if (searchQuery().trim()) {
      setSearchQuery("");
      playSound("confirm");
      return;
    }

    playSound("confirm");
    navigate({ to: "/home" });
  };

  const startRegular = (song: LocalSong) => {
    playSound("confirm");
    navigate({ to: "/sing/$hash", params: { hash: song.hash } });
  };

  const startMedley = () => {
    playSound("confirm");
    navigate({ to: "/sing/medley", search: { songs: medleySongs().map((song) => song.hash) } });
  };

  const selectRandomSong = () => {
    const randomSong = songSelectStyle() === "grid" ? gridRef?.goToRandomSong() : scrollerRef?.goToRandomSong();
    if (randomSong) {
      setCurrentSong(randomSong);
    }
  };

  const startRandomMedley = () => {
    const songsList = songs();
    const nonDuetSongs = songsList.filter((song) => song.voices.length < 2);

    if (nonDuetSongs.length === 0) {
      return;
    }

    const selectedSongs: LocalSong[] = [];
    const targetCount = 5;

    // Try to dedup if we have enough songs
    if (nonDuetSongs.length >= targetCount) {
      const available = [...nonDuetSongs];
      for (let i = 0; i < targetCount; i++) {
        const randomIndex = Math.floor(Math.random() * available.length);
        const song = available[randomIndex];
        if (song) {
          selectedSongs.push(song);
          available.splice(randomIndex, 1);
        }
      }
    } else {
      // Not enough songs to dedup, pick random ones allowing duplicates
      for (let i = 0; i < targetCount; i++) {
        const randomIndex = Math.floor(Math.random() * nonDuetSongs.length);
        const song = nonDuetSongs[randomIndex];
        if (song) {
          selectedSongs.push(song);
        }
      }
    }

    playSound("confirm");
    navigate({ to: "/sing/medley", search: { songs: selectedSongs.map((song) => song.hash) } });
  };

  const moveSorting = (direction: "left" | "right") => {
    const SORT_OPTIONS: SortOption[] = ["artist", "title", "year"];
    const currentIndex = SORT_OPTIONS.indexOf(sort());
    const newIndex = (currentIndex + (direction === "left" ? -1 : 1) + SORT_OPTIONS.length) % SORT_OPTIONS.length;
    setSort(SORT_OPTIONS[newIndex] || "artist");
  };

  useNavigation({
    onKeydown(event) {
      if (event.action === "back") {
        onBack();
      } else if (event.action === "search") {
        setSearchPopupOpen(!searchPopupOpen());
        playSound("select");
      } else if (event.action === "menu") {
        setMenuOpen(!menuOpen());
        setSearchPopupOpen(false);
        playSound("select");
      } else if (event.action === "random") {
        selectRandomSong();
        playSound("select");
      } else if (event.action === "sort-left") {
        moveSorting("left");
        playSound("select");
      } else if (event.action === "sort-right") {
        moveSorting("right");
        playSound("select");
      } else if (event.action === "add-to-medley") {
        const song = currentSong();
        if (song) {
          setMedleySongs((prev) => [...prev, song]);
          playSound("select");
        }
      } else if (event.action === "start-random-medley") {
        startRandomMedley();
      }
    },
    onKeyup(event) {
      if (event.action === "confirm") {
        if (isMedley()) {
          startMedley();
          return;
        }

        const song = currentSong();
        if (song) {
          startRegular(song);
        }
      }
    },
  });

  const handleCenteredItemChange = (song: LocalSong | null) => {
    setCurrentSong(song);
  };

  return (
    <Layout
      intent="secondary"
      footer={
        <div class="flex justify-between">
          <KeyHints hints={["back", "navigate", "confirm"]} />
          <div class="flex items-center gap-12">
            <div class="flex items-center gap-2">
              <Show when={keyMode() === "keyboard"} fallback={<IconGamepadY class="text-sm" />}>
                <IconF4Key class="text-sm" />
              </Show>
              <button
                type="button"
                class="cursor-pointer text-2xl transition-all hover:opacity-75 active:scale-95"
                onClick={selectRandomSong}
              >
                <IconDices />
              </button>
            </div>
            <SortSelect selected={sort()} onSelect={setSort} />
          </div>
        </div>
      }
      header={
        <div class="flex items-center justify-between gap-20">
          <div class="flex items-center gap-20">
            <TitleBar title={t("sing.songs")} onBack={onBack} />
            <div class="relative flex items-center gap-4">
              <SearchButton
                searchQuery={searchQuery()}
                searchFilter={searchFilter()}
                onClick={() => setSearchPopupOpen(true)}
              />

              <Show when={searchPopupOpen()}>
                <SearchPopup
                  searchQuery={searchQuery()}
                  searchFilter={searchFilter()}
                  onSearchQuery={setSearchQuery}
                  onSearchFilter={setSearchFilter}
                  onClose={() => setSearchPopupOpen(false)}
                />
              </Show>

              <div class="flex items-center gap-2 text-sm opacity-80">
                <IconMusic />
                <Show
                  when={filteredSongCount() !== songs().length}
                  fallback={
                    <span>
                      {songs().length === 1
                        ? t("sing.songCount.one", { count: songs().length })
                        : t("sing.songCount.other", { count: songs().length })}
                    </span>
                  }
                >
                  <span>{t("sing.songCount.filtered", { filtered: filteredSongCount(), total: songs().length })}</span>
                </Show>
              </div>
            </div>
          </div>

          <div class="relative">
            <button
              type="button"
              class="flex cursor-pointer items-center gap-2 transition-all hover:opacity-75 active:scale-95"
              onClick={() => setMenuOpen(true)}
            >
              <Show when={keyMode() === "keyboard"} fallback={<IconGamepadX class="text-sm" />}>
                <IconTabKey class="text-sm" />
              </Show>
              <IconMenu class="text-2xl" />
            </button>

            <Show when={menuOpen()}>
              <MenuPopup
                onClose={() => setMenuOpen(false)}
                onStartRandomMedley={() => {
                  startRandomMedley();
                  setMenuOpen(false);
                }}
                onAddToMedley={() => {
                  const song = currentSong();
                  if (song) {
                    setMedleySongs((prev) => [...prev, song]);
                    playSound("select");
                  }
                  setMenuOpen(false);
                }}
              />
            </Show>
          </div>
        </div>
      }
      background={
        <div class="relative h-full w-full">
          <Presence>
            <Show when={previewSong()} keyed>
              {(song) => (
                <Motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5 }}
                  class="absolute inset-0 z-1"
                >
                  <SongPlayer
                    mode="preview"
                    volume={settingsStore.getVolume("preview")}
                    class="h-full w-full opacity-60"
                    playing
                    song={song}
                  />
                </Motion.div>
              )}
            </Show>
          </Presence>
        </div>
      }
    >
      <Switch>
        <Match when={songSelectStyle() === "grid"}>
          <div class="relative flex h-full min-h-0 gap-8">
            <div class="relative w-1/2 -ml-8">
              <SongGrid
                ref={gridRef}
                items={songs()}
                sort={sort()}
                searchQuery={searchQuery()}
                searchFilter={searchFilter()}
                initialSong={currentSong() ?? undefined}
                class="absolute inset-0"
                onSelectedItemChange={handleCenteredItemChange}
                onFilteredCountChange={setFilteredSongCount}
                onScrollingChange={setIsScrolling}
                onConfirm={startRegular}
              />
            </div>
            <div class="flex w-1/2 flex-col">
              <div class="flex h-1/3 items-center">
                <div class="relative flex flex-col">
                  <p class="text-xl">{currentSong()?.artist}</p>
                  <div class="max-w-full">
                    <span class="gradient-sing bg-linear-to-b bg-clip-text font-bold text-6xl text-transparent">
                      {currentSong()?.title}
                    </span>
                  </div>
                  <div class="absolute top-full">
                    <Show when={(currentSong()?.voices.length || 0) > 1}>
                      <IconDuet />
                    </Show>
                  </div>
                </div>
              </div>
              <div class="mt-8 flex min-h-0 flex-1 gap-2">
                <Show when={currentSong()}>{(song) => <DebouncedHighscoreList songHash={song().hash} />}</Show>
                <Show when={isMedley()}>
                  <MedleyList
                    songs={medleySongs()}
                    onRemove={(index) => {
                      setMedleySongs((prev) => prev.filter((_, i) => i !== index));
                      playSound("select");
                    }}
                    onStart={startMedley}
                    useAlternativeNavigation
                  />
                </Show>
              </div>
            </div>
          </div>
        </Match>
        <Match when={songSelectStyle() === "coverflow"}>
          <div class="relative grid h-full grid-rows-[1fr_auto]">
            <div class="flex grow items-center">
              <div class="relative flex grow flex-col">
                <p class="text-xl">{currentSong()?.artist}</p>
                <div class="max-w-200">
                  <span class="gradient-sing bg-linear-to-b bg-clip-text font-bold text-6xl text-transparent">
                    {currentSong()?.title}
                  </span>
                </div>
                <div class="absolute top-full">
                  <Show when={(currentSong()?.voices.length || 0) > 1}>
                    <IconDuet />
                  </Show>
                </div>
              </div>
              <div class="flex h-full gap-2">
                <Show when={currentSong()}>{(song) => <DebouncedHighscoreList songHash={song().hash} />}</Show>
                <Show when={isMedley()}>
                  <MedleyList
                    songs={medleySongs()}
                    onRemove={(index) => {
                      setMedleySongs((prev) => prev.filter((_, i) => i !== index));
                      playSound("select");
                    }}
                  />
                </Show>
              </div>
            </div>
            <SongScroller
              ref={scrollerRef}
              items={songs()}
              sort={sort()}
              searchQuery={searchQuery()}
              searchFilter={searchFilter()}
              initialSong={currentSong() ?? undefined}
              class="-mx-16 h-60 w-[calc(100%+8cqw)]"
              onCenteredItemChange={handleCenteredItemChange}
              onFilteredCountChange={setFilteredSongCount}
              onScrollingChange={setIsScrolling}
            >
              {(song) => <SongCard song={song} />}
            </SongScroller>
          </div>
        </Match>
      </Switch>
    </Layout>
  );
}
