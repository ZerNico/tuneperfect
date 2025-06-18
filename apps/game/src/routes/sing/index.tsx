import { safe } from "@orpc/client";
import { Key } from "@solid-primitives/keyed";
import { debounce } from "@solid-primitives/scheduled";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import Fuse from "fuse.js";
import { batch, createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from "solid-js";
import { Motion, Presence } from "solid-motionone";
import HighscoreList, { type Highscore } from "~/components/highscore-list";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import SongPlayer from "~/components/song-player";
import TitleBar from "~/components/title-bar";
import { VirtualKeyboard } from "~/components/ui/virtual-keyboard";
import { keyMode, useNavigation } from "~/hooks/navigation";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { playSound } from "~/lib/sound";
import type { LocalSong } from "~/lib/ultrastar/song";
import { lobbyStore } from "~/stores/lobby";
import { settingsStore } from "~/stores/settings";
import { songsStore } from "~/stores/songs";
import IconDices from "~icons/lucide/dices";
import IconMusic from "~icons/lucide/music";
import IconSearch from "~icons/lucide/search";
import IconDuet from "~icons/sing/duet";
import IconF3Key from "~icons/sing/f3-key";
import IconF4Key from "~icons/sing/f4-key";
import IconF5Key from "~icons/sing/f5-key";
import IconF6Key from "~icons/sing/f6-key";
import IconGamepadLB from "~icons/sing/gamepad-lb";
import IconGamepadRB from "~icons/sing/gamepad-rb";
import IconGamepadStart from "~icons/sing/gamepad-start";
import IconGamepadY from "~icons/sing/gamepad-y";
import IconTriangleLeft from "~icons/sing/triangle-left";
import IconTriangleRight from "~icons/sing/triangle-right";

interface SongItem {
  song: LocalSong;
  id: string;
}

export const Route = createFileRoute("/sing/")({
  component: SingComponent,
});

const [currentSong, setCurrentSong] = createSignal<LocalSong | null>();
const [searchQuery, setSearchQuery] = createSignal("");
const [searchFilter, setSearchFilter] = createSignal<"all" | "artist" | "title" | "year" | "genre" | "language" | "edition" | "creator">(
  "all"
);
const [searchPopupOpen, setSearchPopupOpen] = createSignal(false);
const [sort, setSort] = createSignal<"artist" | "title" | "year">("artist");
const [filteredSongCount, setFilteredSongCount] = createSignal(songsStore.songs().length);

const SORT_OPTIONS = ["artist", "title", "year"] as const;

function SingComponent() {
  if (!currentSong()) {
    setCurrentSong(songsStore.songs()[0] || null);
  }

  const navigate = useNavigate();
  const onBack = () => {
    if (searchQuery().trim()) {
      setSearchQuery("");
      playSound("confirm");
      return;
    }

    playSound("confirm");
    navigate({ to: "/home" });
  };
  const [animationsDisabled, setAnimationsDisabled] = createSignal(false);
  const [isFastScrolling, setIsFastScrolling] = createSignal(false);

  const startGame = (song: LocalSong) => {
    playSound("confirm");
    navigate({ to: "/sing/$hash", params: { hash: song.hash } });
  };

  const selectRandomSong = () => {
    setAnimationsDisabled(true);

    const songs = songsStore.songs();
    const randomIndex = Math.floor(Math.random() * songs.length);
    const randomSong = songs[randomIndex];
    if (randomSong) {
      setCurrentSong(randomSong);
    }

    setTimeout(() => {
      setAnimationsDisabled(false);
    }, 0);
  };

  const moveSorting = (direction: "left" | "right") => {
    const currentIndex = SORT_OPTIONS.indexOf(sort());
    const newIndex = (currentIndex + (direction === "left" ? -1 : 1) + SORT_OPTIONS.length) % SORT_OPTIONS.length;
    setSort(SORT_OPTIONS[newIndex] || "artist");
  };

  useNavigation(() => ({
    onKeydown(event) {
      if (event.action === "back") {
        onBack();
      } else if (event.action === "search") {
        setSearchPopupOpen(!searchPopupOpen());
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
      }
    },
    onKeyup(event) {
      if (event.action === "confirm") {
        const song = currentSong();
        if (song) {
          startGame(song);
          playSound("confirm");
        }
      }
    },
  }));

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
            <div class="flex items-center gap-2">
              <Show when={keyMode() === "keyboard"} fallback={<IconGamepadLB class="text-sm" />}>
                <IconF5Key class="text-sm" />
              </Show>
              <button
                type="button"
                class="flex cursor-pointer items-center gap-2 transition-all hover:opacity-75 active:scale-95"
                onClick={() => moveSorting("left")}
              >
                <IconTriangleLeft />
              </button>
              <div>
                <For each={SORT_OPTIONS}>
                  {(sortKey) => (
                    <button
                      type="button"
                      class="gradient-sing cursor-pointer rounded-full px-2 text-md text-white capitalize transition-all hover:opacity-75 active:scale-95"
                      classList={{
                        "gradient-sing bg-gradient-to-b shadow-xl": sortKey.toLowerCase() === sort(),
                      }}
                      onClick={() => setSort(sortKey)}
                    >
                      {t(`sing.sort.${sortKey}`)}
                    </button>
                  )}
                </For>
              </div>

              <button
                type="button"
                class="cursor-pointer transition-all hover:opacity-75 active:scale-95"
                onClick={() => moveSorting("right")}
              >
                <IconTriangleRight />
              </button>
              <Show when={keyMode() === "keyboard"} fallback={<IconGamepadRB class="text-sm" />}>
                <IconF6Key class="text-sm" />
              </Show>
            </div>
          </div>
        </div>
      }
      header={
        <div class="flex items-center gap-20">
          <TitleBar title={t("sing.songs")} onBack={onBack} />
          <div class="relative flex items-center gap-4">
            <SearchButton searchQuery={searchQuery()} searchFilter={searchFilter()} onClick={() => setSearchPopupOpen(true)} />

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
                when={filteredSongCount() !== songsStore.songs().length}
                fallback={
                  <span>
                    {songsStore.songs().length === 1
                      ? t("sing.songCount.one", { count: songsStore.songs().length })
                      : t("sing.songCount.other", { count: songsStore.songs().length })}
                  </span>
                }
              >
                <span>{t("sing.songCount.filtered", { filtered: filteredSongCount(), total: songsStore.songs().length })}</span>
              </Show>
            </div>
          </div>
        </div>
      }
      background={
        <div class="relative h-full w-full">
          <Presence>
            <Show when={!isFastScrolling() && currentSong()} keyed>
              {(currentSong) => {
                return (
                  <Motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    class="absolute inset-0 z-1"
                  >
                    <SongPlayer
                      isPreview
                      volume={settingsStore.getVolume("preview")}
                      class="h-full w-full opacity-60"
                      playing
                      song={currentSong}
                    />
                  </Motion.div>
                );
              }}
            </Show>
          </Presence>
        </div>
      }
    >
      <div class="relative grid h-full grid-rows-[1fr_auto]">
        <div class="flex flex-grow items-center">
          <div class="relative flex flex-grow flex-col">
            <p class="text-xl">{currentSong()?.artist}</p>
            <div class="max-w-200">
              <span class="gradient-sing bg-gradient-to-b bg-clip-text font-bold text-6xl text-transparent ">{currentSong()?.title}</span>
            </div>
            <div class="absolute top-full">
              <Show when={(currentSong()?.voices.length || 0) > 1}>
                <IconDuet />
              </Show>
            </div>
          </div>
          <Show when={currentSong()}>{(song) => <DebouncedHighscoreList songHash={song().hash} />}</Show>
        </div>
        <div>
          <SongScroller
            searchQuery={searchQuery()}
            searchFilter={searchFilter()}
            onSongChange={setCurrentSong}
            onSelect={startGame}
            songs={songsStore.songs()}
            sort={sort()}
            currentSong={currentSong() || null}
            animationsDisabled={animationsDisabled()}
            onIsFastScrolling={setIsFastScrolling}
            onFilteredSongsChange={setFilteredSongCount}
          />
        </div>
      </div>
    </Layout>
  );
}

interface SongScrollerProps {
  songs: LocalSong[];
  sort: "artist" | "title" | "year";
  currentSong: LocalSong | null;
  animationsDisabled: boolean;
  searchQuery: string;
  searchFilter: "all" | "artist" | "title" | "year" | "genre" | "language" | "edition" | "creator";
  onSongChange?: (song: LocalSong | null) => void;
  onSelect?: (song: LocalSong) => void;
  onIsFastScrolling?: (fastScrolling: boolean) => void;
  onFilteredSongsChange?: (count: number) => void;
}

const DISPLAYED_SONGS = 11;
const MIDDLE_SONG_INDEX = Math.floor(DISPLAYED_SONGS / 2);

const positiveModulo = (n: number, m: number) => ((n % m) + m) % m;

function SongScroller(props: SongScrollerProps) {
  const [isPressed, setIsPressed] = createSignal(false);
  const [isHeld, setIsHeld] = createSignal(false);
  const [isFastScrolling, setIsFastScrolling] = createSignal(false);
  const [animating, setAnimating] = createSignal<null | "left" | "right">(null);
  const [pendingDirection, setPendingDirection] = createSignal<null | "left" | "right">(null);

  const [debouncedSearchQuery, setDebouncedSearchQuery] = createSignal("");
  
  const shouldDebounce = () => props.songs.length > 1000;
  
  const debouncedSetQuery = debounce((query: string) => {
    setDebouncedSearchQuery(query);
  }, 500);
  
  createEffect(() => {
    if (shouldDebounce()) {
      debouncedSetQuery(props.searchQuery);
    } else {
      setDebouncedSearchQuery(props.searchQuery);
    }
  });
  
  const fuseInstance = createMemo(() => {
    const keys =
      props.searchFilter === "all" ? ["title", "artist", "year", "genre", "language", "edition", "creator"] : [props.searchFilter];

    return new Fuse(props.songs, {
      keys,
      threshold: 0.1,
      includeScore: true,
      ignoreLocation: true,
    });
  });

  const filteredAndSortedSongs = createMemo(() => {
    let songs = props.songs;

    if (debouncedSearchQuery().trim()) {
      const query = debouncedSearchQuery().toLowerCase().trim();
      const searchResults = fuseInstance().search(query);
      songs = searchResults.map((result) => result.item);
    }

    if (songs.length === 0) {
      return [];
    }

    return songs.toSorted((a: LocalSong, b: LocalSong) => {
      if (props.sort === "title") {
        return a.title.localeCompare(b.title);
      }
      if (props.sort === "year") {
        if (a.year === null && b.year === null) return 0;
        if (a.year === null) return 1;
        if (b.year === null) return -1;
        return a.year - b.year;
      }
      return a.artist.localeCompare(b.artist);
    });
  });

  const calculateIndex = (songs: LocalSong[], currentSong: LocalSong | null): number => {
    if (songs.length === 0) return 0;
    if (!currentSong) return 0;
    const index = songs.findIndex((song) => song === currentSong);
    return index === -1 ? 0 : index;
  };

  const generateDisplayedSongs = (songs: LocalSong[], centerIndex: number): SongItem[] => {
    const numSongs = songs.length;
    if (numSongs === 0) return [];

    const result: SongItem[] = [];
    const offset = MIDDLE_SONG_INDEX;

    for (let i = 0; i < DISPLAYED_SONGS; i++) {
      const relativeIndex = i - offset;
      const songIndex = positiveModulo(centerIndex + relativeIndex, numSongs);
      const song = songs[songIndex];
      if (song) {
        result.push({ song, id: crypto.randomUUID() });
      } else if (numSongs > 0) {
        const firstSong = songs[0];
        if (firstSong) {
          result.push({ song: firstSong, id: crypto.randomUUID() });
        }
      }
    }
    return result;
  };

  const initialSongs = filteredAndSortedSongs();
  const [currentIndex, setCurrentIndex] = createSignal(calculateIndex(initialSongs, props.currentSong));
  const [displayedSongs, setDisplayedSongs] = createSignal<SongItem[]>(generateDisplayedSongs(initialSongs, currentIndex()));

  createEffect(
    on(
      [() => props.currentSong, filteredAndSortedSongs],
      ([currentSongProp, songs]) => {
        const newIndex = calculateIndex(songs, currentSongProp);
        const newCurrentSong = songs.length > 0 ? songs[newIndex] : null;

        setCurrentIndex(newIndex);
        setDisplayedSongs(generateDisplayedSongs(songs, newIndex));

        if (newCurrentSong !== currentSongProp) {
          props.onSongChange?.(newCurrentSong || null);
        }
      },
      { defer: true }
    )
  );

  useNavigation(() => ({
    onKeydown(event) {
      if (event.action === "left") {
        if (animating()) {
          setPendingDirection("left");
        } else {
          animateTo("left");
        }
        playSound("select");
      } else if (event.action === "right") {
        if (animating()) {
          setPendingDirection("right");
        } else {
          animateTo("right");
        }
        playSound("select");
      } else if (event.action === "confirm") {
        setIsPressed(true);
      }
    },

    onKeyup(event) {
      if (event.action === "confirm") {
        setIsPressed(false);

        if (!animating() && props.currentSong) {
          const displayed = displayedSongs();
          const middleDisplayedSong = displayed[MIDDLE_SONG_INDEX];
          if (middleDisplayedSong && middleDisplayedSong.song === props.currentSong) {
            props.onSelect?.(props.currentSong);
          }
        }
      } else if (event.action === "left" || event.action === "right") {
        setIsHeld(false);
        if (!isFastScrolling()) {
          props.onIsFastScrolling?.(false);
        }
      }
    },

    onHold(event) {
      if (event.action === "left") {
        setIsHeld(true);
        if (!animating()) {
          animateTo("left");
          playSound("select");
        }
      } else if (event.action === "right") {
        setIsHeld(true);
        if (!animating()) {
          animateTo("right");
          playSound("select");
        }
      }
    },
  }));

  const animateTo = (direction: "left" | "right") => {
    if (animating()) {
      if (!isHeld()) return;
    }

    const songs = filteredAndSortedSongs();
    if (songs.length === 0) return;

    if (isHeld()) {
      props.onIsFastScrolling?.(true);
      setIsFastScrolling(true);
    }

    setAnimating(direction);
  };

  const onTransitionEnd = () => {
    const direction = animating();
    if (!direction) {
      return;
    }

    const songs = filteredAndSortedSongs();
    if (songs.length === 0) {
      batch(() => {
        setCurrentIndex(0);
        if (props.currentSong !== null) props.onSongChange?.(null);
        setAnimating(null);
        setIsHeld(false);
        setIsFastScrolling(false);
        props.onIsFastScrolling?.(false);
      });
      return;
    }

    const numSongs = songs.length;
    let nextIndex: number;

    if (direction === "left") {
      nextIndex = positiveModulo(currentIndex() - 1, numSongs);
    } else {
      nextIndex = positiveModulo(currentIndex() + 1, numSongs);
    }

    const nextSong = songs[nextIndex];

    batch(() => {
      setCurrentIndex(nextIndex);

      if (numSongs > 1) {
        if (direction === "left") {
          const newFirstSongIndex = positiveModulo(nextIndex - MIDDLE_SONG_INDEX, numSongs);
          const song = songs[newFirstSongIndex];
          if (song) {
            setDisplayedSongs((d) => [{ song, id: crypto.randomUUID() }, ...d.slice(0, -1)]);
          }
        } else {
          const newLastSongIndex = positiveModulo(nextIndex + MIDDLE_SONG_INDEX, numSongs);
          const song = songs[newLastSongIndex];
          if (song) {
            setDisplayedSongs((d) => [...d.slice(1), { song, id: crypto.randomUUID() }]);
          }
        }
      } else if (numSongs === 1) {
        if (direction === "left") {
          setDisplayedSongs((d) => {
            const last = d.at(-1);
            if (!last) return d;
            return [last, ...d.slice(0, -1)];
          });
        } else {
          setDisplayedSongs((d) => {
            const first = d[0];
            if (!first) return d;
            return [...d.slice(1), first];
          });
        }
      }

      if (nextSong && nextSong !== props.currentSong) {
        props.onSongChange?.(nextSong);
      }
      setAnimating(null);

      const pending = pendingDirection();
      if (pending) {
        setPendingDirection(null);
        setTimeout(() => {
          animateTo(pending);
        }, 0);
      } else if (isHeld()) {
        props.onIsFastScrolling?.(true);
        setIsFastScrolling(true);
        playSound("select");
        setTimeout(() => {
          if (isHeld()) {
            animateTo(direction);
          } else {
            setIsFastScrolling(false);
            props.onIsFastScrolling?.(false);
          }
        }, 0);
      } else {
        setIsFastScrolling(false);
        props.onIsFastScrolling?.(false);
      }
    });
  };

  const isActive = (index: number, currentAnimating: "left" | "right" | null) => {
    if (currentAnimating === "right") {
      return index === MIDDLE_SONG_INDEX + 1;
    }
    if (currentAnimating === "left") {
      return index === MIDDLE_SONG_INDEX - 1;
    }
    return index === MIDDLE_SONG_INDEX;
  };

  const getSongTransform = (index: number, currentAnimating: "left" | "right" | null): string => {
    const active = isActive(index, currentAnimating);

    if (active) {
      return "";
    }

    if (index === MIDDLE_SONG_INDEX) {
      if (currentAnimating === "right") return "-translate-x-8";
      if (currentAnimating === "left") return "translate-x-8";
      return "";
    }

    if (index < MIDDLE_SONG_INDEX) {
      return "-translate-x-8";
    }

    return "translate-x-8";
  };

  const scrollerClasses = createMemo(() => {
    return {
      "translate-x-0": animating() === null,
      "translate-x-1/11 transition-transform duration-250": animating() === "left",
      "-translate-x-1/11 transition-transform duration-250": animating() === "right",
      "duration-150! ease-linear!": isFastScrolling() && !!animating(),
      "duration-0! ease-linear!": props.animationsDisabled,
    };
  });

  const songCardClasses = (index: number, currentAnimating: "left" | "right" | null) => ({
    [getSongTransform(index, currentAnimating)]: true,
    "hover:opacity-50 active:scale-90": isActive(index, currentAnimating),
    "scale-90": isActive(index, currentAnimating) && isPressed(),
    "duration-150! ease-linear!": isFastScrolling() && !!currentAnimating,
    "duration-0! ease-linear!": props.animationsDisabled,
  });

  // Update the parent component with the song count
  createEffect(() => {
    const songCount = filteredAndSortedSongs().length;
    props.onFilteredSongsChange?.(songCount);
  });

  return (
    <div class="flex w-full flex-col items-center justify-center">
      <div
        class="flex w-11/7 transform-gpu ease-in-out will-change-transform"
        classList={scrollerClasses()}
        onTransitionEnd={onTransitionEnd}
      >
        <Key each={displayedSongs()} by={(item) => item.id}>
          {(item, index) => {
            const active = createMemo(() => isActive(index(), animating()));
            const song = item().song;

            return (
              <button
                type="button"
                class="w-1/7 transform-gpu cursor-pointer p-2 transition-all duration-250 will-change-transform"
                classList={songCardClasses(index(), animating())}
                onTransitionEnd={(e) => e.stopPropagation()}
                onClick={() => {
                  if (animating()) return;

                  if (index() === MIDDLE_SONG_INDEX) {
                    props.onSelect?.(song);
                  } else {
                    animateTo(index() > MIDDLE_SONG_INDEX ? "right" : "left");
                  }
                }}
              >
                <SongCard
                  song={song}
                  active={active()}
                  fastScrolling={isFastScrolling() && !!animating()}
                  animationsDisabled={props.animationsDisabled}
                />
              </button>
            );
          }}
        </Key>
      </div>
    </div>
  );
}

interface SongCardProps {
  song: LocalSong;
  class?: string;
  classList?: Record<string, boolean>;
  active?: boolean;
  fastScrolling?: boolean;
  animationsDisabled?: boolean;
}

function SongCard(props: SongCardProps) {
  return (
    <div
      class="relative aspect-square transform-gpu overflow-hidden rounded-lg shadow-md transition-transform duration-250 will-change-transform"
      classList={{
        [props.class || ""]: true,
        "scale-130": props.active,
        "duration-150! ease-linear!": props.fastScrolling,
        "duration-0! ease-linear!": props.animationsDisabled,
      }}
    >
      <img
        class="relative z-1 h-full w-full object-cover transition-opacity duration-250 will-change-opacity"
        classList={{
          "opacity-60": !props.active,
          "opacity-100": props.active,
          "duration-150! ease-linear!": props.fastScrolling,
          "duration-0! ease-linear!": props.animationsDisabled,
        }}
        src={props.song.coverUrl ?? ""}
        alt={props.song.title}
      />
      <div class="absolute inset-0 bg-black" />
    </div>
  );
}

interface SearchButtonProps {
  searchQuery: string;
  searchFilter: "all" | "artist" | "title" | "year" | "genre" | "language" | "edition" | "creator";
  onClick: () => void;
}

function SearchButton(props: SearchButtonProps) {
  const filterOptions: Array<{ value: "all" | "artist" | "title" | "year" | "genre" | "language" | "edition" | "creator"; label: string }> =
    [
      { value: "all", label: t("sing.filter.all") },
      { value: "artist", label: t("sing.sort.artist") },
      { value: "title", label: t("sing.sort.title") },
      { value: "year", label: t("sing.sort.year") },
      { value: "genre", label: t("sing.filter.genre") },
      { value: "language", label: t("sing.filter.language") },
      { value: "edition", label: t("sing.filter.edition") },
      { value: "creator", label: t("sing.filter.creator") },
    ];

  const filterLabel = () => filterOptions.find((option) => option.value === props.searchFilter)?.label || t("sing.filter.all");

  return (
    <button
      type="button"
      class="flex w-40 items-center gap-1 rounded-full border-[0.12cqw] border-white px-1 py-0.5 text-sm transition-all hover:opacity-75 active:scale-95"
      onClick={props.onClick}
    >
      <IconSearch class="flex-shrink-0" />
      <div class="flex w-full min-w-0 items-center gap-2">
        <span class="flex-grow truncate text-start">{props.searchQuery || t("sing.search")}</span>
        <Show when={props.searchQuery}>
          <span class="flex-shrink-0 rounded-full bg-white/20 px-1.5 py-0.4 text-xs">{filterLabel()}</span>
        </Show>
      </div>
      <Show when={keyMode() === "keyboard"} fallback={<IconGamepadStart class="flex-shrink-0 text-xs" />}>
        <IconF3Key class="flex-shrink-0 text-xs" />
      </Show>
    </button>
  );
}

interface SearchPopupProps {
  searchQuery: string;
  searchFilter: "all" | "artist" | "title" | "year" | "genre" | "language" | "edition" | "creator";
  onSearchQuery: (query: string) => void;
  onSearchFilter: (filter: "all" | "artist" | "title" | "year" | "genre" | "language" | "edition" | "creator") => void;
  onClose: () => void;
}

function SearchPopup(props: SearchPopupProps) {
  let searchRef!: HTMLInputElement;
  let popupRef!: HTMLDivElement;

  createEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popupRef && !popupRef.contains(event.target as Node)) {
        props.onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    onCleanup(() => {
      document.removeEventListener("mousedown", handleClickOutside);
    });
  });

  const onInput = (e: InputEvent & { currentTarget: HTMLInputElement }) => {
    props.onSearchQuery(e.currentTarget.value);
  };

  const filterOptions: Array<{ value: "all" | "artist" | "title" | "year" | "genre" | "language" | "edition" | "creator"; label: string }> =
    [
      { value: "all", label: t("sing.filter.all") },
      { value: "artist", label: t("sing.sort.artist") },
      { value: "title", label: t("sing.sort.title") },
      { value: "year", label: t("sing.sort.year") },
      { value: "genre", label: t("sing.filter.genre") },
      { value: "language", label: t("sing.filter.language") },
      { value: "edition", label: t("sing.filter.edition") },
      { value: "creator", label: t("sing.filter.creator") },
    ];

  const moveFilter = (direction: "left" | "right") => {
    const currentIndex = filterOptions.findIndex((option) => option.value === props.searchFilter);
    const newIndex = (currentIndex + (direction === "left" ? -1 : 1) + filterOptions.length) % filterOptions.length;
    const newOption = filterOptions[newIndex];
    if (newOption) {
      props.onSearchFilter(newOption.value);
    }
  };

  useNavigation(() => ({
    layer: 1,
    onKeydown(event) {
      if (event.action === "back" || event.action === "search") {
        props.onClose();
      } else if (event.action === "filter-left") {
        moveFilter("left");
      } else if (event.action === "filter-right") {
        moveFilter("right");
      }
    },

    onKeyup(event) {
      if (event.origin === "keyboard") {
        if (event.action === "confirm" && event.originalKey !== " ") {
          props.onClose();
        }
      }
    },
  }));

  onMount(() => {
    searchRef.focus();
  });

  return (
    <div class="absolute top-full left-0 z-20 mt-2" ref={popupRef}>
      <Motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        class="w-96 rounded-lg bg-slate-900 p-4 text-white shadow-xl"
      >
        <div class="space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <Show when={keyMode() === "keyboard"} fallback={<IconGamepadLB class="text-sm" />}>
                <IconF5Key class="text-sm" />
              </Show>
              <button
                type="button"
                class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-slate-800 transition-transform hover:opacity-75 active:scale-95"
                onClick={() => moveFilter("left")}
              >
                <IconTriangleLeft class="text-xs" />
              </button>
            </div>

            <div class="flex justify-center">
              <div class="rounded-md bg-slate-800 px-3 py-1">
                <span class="font-medium text-sm text-white">
                  {filterOptions.find((option) => option.value === props.searchFilter)?.label || t("sing.filter.all")}
                </span>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button
                type="button"
                class="flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-slate-800 transition-transform hover:opacity-75 active:scale-95"
                onClick={() => moveFilter("right")}
              >
                <IconTriangleRight class="text-xs" />
              </button>
              <Show when={keyMode() === "keyboard"} fallback={<IconGamepadRB class="text-sm" />}>
                <IconF6Key class="text-sm" />
              </Show>
            </div>
          </div>

          <input
            value={props.searchQuery}
            onInput={onInput}
            ref={searchRef}
            type="text"
            placeholder={t("sing.search")}
            class="focus:gradient-sing w-full rounded-md bg-slate-800 px-3 py-2 text-white placeholder-gray-400 transition-all focus:bg-gradient-to-r focus:outline-none"
          />
        </div>

        <Show when={keyMode() === "gamepad"}>
          <div class="mt-4 flex justify-center">
            <VirtualKeyboard inputRef={searchRef} layer={1} onClose={props.onClose} />
          </div>
        </Show>
      </Motion.div>
    </div>
  );
}

interface DebouncedHighscoreListProps {
  songHash: string;
}

function DebouncedHighscoreList(props: DebouncedHighscoreListProps) {
  const [highscores, setHighscores] = createSignal<Highscore[]>([]);

  createEffect(
    on(
      () => props.songHash,
      () => {
        setHighscores([]);

        const timeout = setTimeout(async () => {
          if (!lobbyStore.lobby()) return;

          const hash = props.songHash;
          if (!hash) return;
          const [error, data] = await safe(client.highscore.getHighscores.call({ hash }));
          if (error) return;

          setHighscores(data);
        }, 1000);

        onCleanup(() => {
          clearTimeout(timeout);
        });
      }
    )
  );

  return (
    <div class="h-full transition-opacity duration-250" classList={{ "opacity-0": highscores().length === 0 }}>
      <HighscoreList scores={highscores()} />
    </div>
  );
}
