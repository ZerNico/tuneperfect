import { mergeRefs } from "@solid-primitives/refs";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import Fuse from "fuse.js";
import { For, type Ref, Show, batch, createEffect, createMemo, createSignal, on } from "solid-js";
import { Transition } from "solid-transition-group";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import SongPlayer from "~/components/song-player";
import TitleBar from "~/components/title-bar";
import { VirtualKeyboard } from "~/components/ui/virtual-keyboard";
import { useNavigation } from "~/hooks/navigation";
import { keyMode } from "~/hooks/navigation";
import { t } from "~/lib/i18n";
import { playSound } from "~/lib/sound";
import type { LocalSong } from "~/lib/ultrastar/parser/local";
import { settingsStore } from "~/stores/settings";
import { songsStore } from "~/stores/songs";
import IconDices from "~icons/lucide/dices";
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
export const Route = createFileRoute("/sing/")({
  component: SingComponent,
});

const [currentSong, setCurrentSong] = createSignal<LocalSong | null>();

const SORT_OPTIONS = ["artist", "title", "year"] as const;

function SingComponent() {
  if (!currentSong()) {
    setCurrentSong(songsStore.songs()[0] || null);
  }

  const navigate = useNavigate();
  const onBack = () => {
    playSound("confirm");
    navigate({ to: "/home" });
  };
  const [sort, setSort] = createSignal<"artist" | "title" | "year">("artist");
  const [animationsDisabled, setAnimationsDisabled] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchFocused, setSearchFocused] = createSignal(false);
  const [isFastScrolling, setIsFastScrolling] = createSignal(false);
  let searchRef!: HTMLInputElement;

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
        searchRef.focus();
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
              <button type="button" class="text-2xl transition-all hover:opacity-75 active:scale-95" onClick={selectRandomSong}>
                <IconDices />
              </button>
            </div>
            <div class="flex items-center gap-2">
              <Show when={keyMode() === "keyboard"} fallback={<IconGamepadLB class="text-sm" />}>
                <IconF5Key class="text-sm" />
              </Show>
              <button
                type="button"
                class="flex items-center gap-2 transition-all hover:opacity-75 active:scale-95"
                onClick={() => moveSorting("left")}
              >
                <IconTriangleLeft />
              </button>
              <div>
                <For each={SORT_OPTIONS}>
                  {(sortKey) => (
                    <button
                      type="button"
                      class="gradient-sing cursor-pointer rounded-full px-2 text-md text-white capitalize shadow-xl transition-all hover:opacity-75 active:scale-95"
                      classList={{
                        "gradient-sing bg-gradient-to-b": sortKey.toLowerCase() === sort(),
                      }}
                      onClick={() => setSort(sortKey)}
                    >
                      {t(`sing.sort.${sortKey}`)}
                    </button>
                  )}
                </For>
              </div>

              <button type="button" class="transition-all hover:opacity-75 active:scale-95" onClick={() => moveSorting("right")}>
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
        <div class="flex gap-20">
          <TitleBar title={t("sing.songs")} onBack={onBack} />
          <SearchBar
            ref={searchRef}
            onSearch={setSearchQuery}
            onFocus={() => {
              setSearchFocused(true);
              setAnimationsDisabled(true);
            }}
            onBlur={() => {
              setSearchFocused(false);
              setAnimationsDisabled(false);
            }}
          />
        </div>
      }
      background={
        <div class="relative h-full w-full">
          <Transition
            onExit={(el, done) => {
              const element = el as HTMLElement;
              element.style.position = "absolute";
              element.style.zIndex = "1";
              element.style.top = "0";
              element.style.left = "0";

              const a = el.animate([{ opacity: 1 }, { opacity: 0 }], {
                duration: 300,
              });
              a.finished.then(done);
            }}
            onEnter={(el, done) => {
              const element = el as HTMLElement;
              element.style.position = "absolute";
              element.style.zIndex = "1";
              element.style.top = "0";
              element.style.left = "0";

              const a = el.animate([{ opacity: 0 }, { opacity: 1 }], {
                duration: 300,
              });
              a.finished.then(done);
            }}
          >
            <Show when={!isFastScrolling() && currentSong()} keyed>
              {(currentSong) => (
                <div class="h-full w-full">
                  <SongPlayer
                    isPreview
                    volume={settingsStore.getVolume("preview")}
                    class="h-full w-full opacity-60"
                    playing
                    song={currentSong}
                  />
                </div>
              )}
            </Show>
          </Transition>
        </div>
      }
    >
      <div class="relative flex flex-grow flex-col">
        <Show when={searchFocused() && keyMode() === "gamepad"}>
          <div class="absolute z-10">
            <VirtualKeyboard inputRef={searchRef} />
          </div>
        </Show>

        <div class="flex flex-grow flex-col justify-center">
          <div class="relative flex flex-col">
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
        </div>
        <div>
          <SongScroller
            searchQuery={searchQuery()}
            onSongChange={setCurrentSong}
            onSelect={startGame}
            songs={songsStore.songs()}
            sort={sort()}
            currentSong={currentSong() || null}
            animationsDisabled={animationsDisabled()}
            onIsFastScrolling={setIsFastScrolling}
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
  onSongChange?: (song: LocalSong | null) => void;
  onSelect?: (song: LocalSong) => void;
  onIsFastScrolling?: (fastScrolling: boolean) => void;
}

const DISPLAYED_SONGS = 11;
const MIDDLE_SONG_INDEX = Math.floor(DISPLAYED_SONGS / 2);

const positiveModulo = (n: number, m: number) => ((n % m) + m) % m;

function SongScroller(props: SongScrollerProps) {
  const [isPressed, setIsPressed] = createSignal(false);
  const [isHeld, setIsHeld] = createSignal(false);
  const [isFastScrolling, setIsFastScrolling] = createSignal(false);
  const [animating, setAnimating] = createSignal<null | "left" | "right">(null);

  const fuseInstance = createMemo(() => {
    return new Fuse(props.songs, {
      keys: ["title", "artist"],
      threshold: 0.2,
      includeScore: true,
      ignoreLocation: true,
    });
  });

  const filteredAndSortedSongs = createMemo(() => {
    let songs = props.songs;

    if (props.searchQuery.trim()) {
      const query = props.searchQuery.toLowerCase().trim();
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
        if (a.year === undefined && b.year === undefined) return 0;
        if (a.year === undefined) return 1;
        if (b.year === undefined) return -1;
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

  const initialSongs = filteredAndSortedSongs();
  const [currentIndex, setCurrentIndex] = createSignal(calculateIndex(initialSongs, props.currentSong));

  createEffect(
    on(
      [() => props.currentSong, filteredAndSortedSongs],
      ([currentSongProp, songs]) => {
        const newIndex = calculateIndex(songs, currentSongProp);
        const newCurrentSong = songs.length > 0 ? songs[newIndex] : null;

        setCurrentIndex(newIndex);

        if (newCurrentSong !== currentSongProp) {
          props.onSongChange?.(newCurrentSong || null);
        }
      },
      { defer: true }
    )
  );

  const displayedSongs = createMemo(() => {
    const songs = filteredAndSortedSongs();
    const numSongs = songs.length;
    if (numSongs === 0) return [];

    const result: LocalSong[] = [];
    const index = currentIndex();
    const offset = MIDDLE_SONG_INDEX;

    for (let i = 0; i < DISPLAYED_SONGS; i++) {
      const relativeIndex = i - offset;
      const songIndex = positiveModulo(index + relativeIndex, numSongs);
      const song = songs[songIndex];
      if (song) {
        result.push(song);
      } else if (numSongs > 0) {
        const firstSong = songs[0];
        if (firstSong) {
          result.push(firstSong);
        }
      }
    }
    return result;
  });

  useNavigation(() => ({
    onKeydown(event) {
      if (animating()) return;

      if (event.action === "left") {
        animateTo("left");
        playSound("select");
      } else if (event.action === "right") {
        animateTo("right");
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
          if (middleDisplayedSong === props.currentSong) {
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
      if (animating()) return;

      if (event.action === "left") {
        setIsHeld(true);
        animateTo("left");
        playSound("select");
      } else if (event.action === "right") {
        setIsHeld(true);
        animateTo("right");
        playSound("select");
      }
    },
  }));

  const animateTo = (direction: "left" | "right") => {
    if (animating()) {
      if (!isHeld()) return;
    }

    const songs = filteredAndSortedSongs();
    if (songs.length <= 1) return;

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

      if (nextSong && nextSong !== props.currentSong) {
        props.onSongChange?.(nextSong);
      }
      setAnimating(null);

      if (isHeld()) {
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

  const scrollerClasses = createMemo(() => ({
    "translate-x-0": animating() === null,
    "translate-x-1/11 transition-transform duration-250": animating() === "left",
    "-translate-x-1/11 transition-transform duration-250": animating() === "right",
    "duration-150! ease-linear!": isFastScrolling() && !!animating(),
    "duration-0! ease-linear!": props.animationsDisabled,
  }));

  const songCardClasses = (index: number, currentAnimating: "left" | "right" | null) => ({
    [getSongTransform(index, currentAnimating)]: true,
    "hover:opacity-50 active:scale-90": isActive(index, currentAnimating),
    "scale-90": isActive(index, currentAnimating) && isPressed(),
    "duration-150! ease-linear!": isFastScrolling() && !!currentAnimating,
    "duration-0! ease-linear!": props.animationsDisabled,
  });

  return (
    <div class="flex w-full flex-col items-center justify-center">
      <div
        class="flex w-11/7 transform-gpu ease-in-out will-change-transform"
        classList={scrollerClasses()}
        onTransitionEnd={onTransitionEnd}
      >
        <For each={displayedSongs()}>
          {(song, index) => {
            const active = createMemo(() => isActive(index(), animating()));

            return (
              <button
                type="button"
                class="w-1/7 transform-gpu p-2 transition-all duration-250 will-change-transform"
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
        </For>
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
      class="relative aspect-square transform-gpu overflow-hidden rounded-lg shadow-xl transition-transform duration-250 will-change-transform"
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
        src={props.song.coverUrl}
        alt={props.song.title}
      />
      <div class="absolute inset-0 bg-black" />
    </div>
  );
}

interface SearchBarProps {
  onSearch?: (query: string) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  ref?: Ref<HTMLInputElement>;
}

function SearchBar(props: SearchBarProps) {
  const [focused, setFocused] = createSignal(false);
  let searchRef!: HTMLInputElement;

  const onFocus = () => {
    setFocused(true);
    props.onFocus?.();
  };

  const onBlur = () => {
    setFocused(false);
    props.onBlur?.();
  };

  const onInput = (e: InputEvent & { currentTarget: HTMLInputElement }) => {
    props.onSearch?.(e.currentTarget.value);
  };

  const moveCursor = (direction: "left" | "right") => {
    const start = searchRef.selectionStart ?? 0;
    searchRef.setSelectionRange(Math.max(0, start + (direction === "left" ? -1 : 1)), Math.max(0, start + (direction === "left" ? -1 : 1)));
  };

  const writeCharacter = (char: string) => {
    const start = searchRef.selectionStart ?? 0;
    const end = searchRef.selectionEnd ?? 0;
    const value = searchRef.value;
    searchRef.value = value.substring(0, start) + char + value.substring(end);
    searchRef.setSelectionRange(start + 1, start + 1);
  };

  useNavigation(() => ({
    layer: 1,
    enabled: focused(),
    onKeydown(event) {
      if (event.action === "back") {
        searchRef.blur();
      }

      if (event.origin === "keyboard") {
        if (event.action === "left") {
          moveCursor("left");
        } else if (event.action === "right") {
          moveCursor("right");
        }
      }

      if (event.origin === "keyboard" && event.originalKey === " ") {
        writeCharacter(" ");
      }
    },

    onRepeat(event) {
      if (event.origin !== "keyboard") {
        return;
      }

      if (event.action === "left") {
        moveCursor("left");
      } else if (event.action === "right") {
        moveCursor("right");
      }
    },
  }));

  return (
    <div class="flex items-center gap-1 rounded-full border-[0.12cqw] border-white px-1 py-0.5 text-sm">
      <IconSearch />
      <input
        onFocus={onFocus}
        onBlur={onBlur}
        onInput={onInput}
        ref={mergeRefs(props.ref, (el) => {
          searchRef = el;
        })}
        type="text"
        placeholder={t("sing.search")}
        class="bg-transparent text-white focus:outline-none"
      />
      <Show
        when={keyMode() === "keyboard"}
        fallback={<IconGamepadStart class="transition-opacity" classList={{ "opacity-0": focused() }} />}
      >
        <IconF3Key class="transition-opacity" classList={{ "opacity-0": focused() }} />
      </Show>
    </div>
  );
}
