import { Key } from "@solid-primitives/keyed";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { For, Show, batch, createMemo, createSignal } from "solid-js";
import { Transition } from "solid-transition-group";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import SongPlayer from "~/components/song-player";
import TitleBar from "~/components/title-bar";
import Avatar from "~/components/ui/avatar";
import { useNavigation } from "~/hooks/navigation";
import { t } from "~/lib/i18n";
import type { User } from "~/lib/types";
import type { LocalSong } from "~/lib/ultrastar/parser/local";
import { getColorVar } from "~/lib/utils/color";
import { times } from "~/lib/utils/loop";
import { versusStore } from "~/stores/party/versus";
import { settingsStore } from "~/stores/settings";
import { songsStore } from "~/stores/songs";
import IconDices from "~icons/lucide/dices";

interface SongItem {
  song: LocalSong | null;
  id: string;
}

const SONGS_ON_SCREEN = 5;
const SONGS_BEFORE_AFTER = 3;
const SONGS_BETWEEN = 40;
const PADDING = SONGS_BETWEEN + SONGS_BEFORE_AFTER - 2;
const TOTAL_SONG_ITEMS = PADDING + 2 * SONGS_BEFORE_AFTER + SONGS_BETWEEN + 2;

export const Route = createFileRoute("/party/versus/")({
  component: VersusComponent,
});

function VersusComponent() {
  const navigate = useNavigate();
  const onBack = () => navigate({ to: "/party/versus/settings" });

  const availableSongs = createMemo(() => {
    return songsStore.songs().filter((song) => song.voices.length === 1);
  });

  const getRandomSong = () => {
    return availableSongs()[Math.floor(Math.random() * availableSongs().length)];
  };

  const getRandomSongWithoutDuplicates = (playedSongs: LocalSong[]) => {
    const availableSongs = songsStore.songs().filter((song) => !playedSongs.includes(song));
    return availableSongs[Math.floor(Math.random() * availableSongs.length)] ?? getRandomSong();
  };

  const generateUUID = () => {
    return crypto.randomUUID();
  };

  const generateDisplayedSongs = () => {
    const displayedSongs: SongItem[] = [];

    // Songs before selected
    for (const _ of times(SONGS_BEFORE_AFTER)) {
      const song = getRandomSong();
      if (!song) return null;
      displayedSongs.push({ song, id: generateUUID() });
    }

    const selected = getRandomSongWithoutDuplicates(versusStore.state().playedSongs);
    if (!selected) return null;
    displayedSongs.push({ song: selected, id: generateUUID() });

    // Songs between selected and next
    for (const _ of times(SONGS_BETWEEN)) {
      const song = getRandomSong();
      if (!song) return null;
      displayedSongs.push({ song, id: generateUUID() });
    }

    // Next song
    const next = getRandomSongWithoutDuplicates([...versusStore.state().playedSongs, selected]);
    if (!next) return null;
    displayedSongs.push({ song: next, id: generateUUID() });

    // Songs after next
    for (const _ of times(SONGS_BEFORE_AFTER)) {
      const song = getRandomSong();
      if (!song) return null;
      displayedSongs.push({ song, id: generateUUID() });
    }

    return displayedSongs;
  };

  const generateNextDisplayedSongs = (currentDisplayedSongs: SongItem[] | null) => {
    if (!currentDisplayedSongs) {
      return generateDisplayedSongs();
    }

    const displayedSongs: SongItem[] = [];

    const keepFromPrevious = SONGS_BEFORE_AFTER * 2 + 1;
    const songsToKeep = currentDisplayedSongs.slice(-keepFromPrevious);
    displayedSongs.push(...songsToKeep);

    const selected = displayedSongs[SONGS_BEFORE_AFTER]?.song;
    if (!selected) {
      return null;
    }

    for (const _ of times(SONGS_BETWEEN - SONGS_BEFORE_AFTER)) {
      const song = getRandomSong();
      if (!song) return null;
      displayedSongs.push({ song, id: generateUUID() });
    }

    const nextPlayedSongs = versusStore.state().playedSongs;

    const next = getRandomSongWithoutDuplicates([...nextPlayedSongs, selected]);
    if (!next) return null;
    displayedSongs.push({ song: next, id: generateUUID() });

    for (const _ of times(SONGS_BEFORE_AFTER)) {
      const song = getRandomSong();
      if (!song) return null;
      displayedSongs.push({ song, id: generateUUID() });
    }

    return displayedSongs;
  };

  const [displayedSongs, setDisplayedSongs] = createSignal<SongItem[] | null>(generateDisplayedSongs());

  const [state, setState] = createSignal<"selected" | "animating">("selected");

  const selectNextSong = () => {
    setState("animating");
  };

  const onTransitionEnd = () => {
    setTimeout(() => {
      batch(() => {
        setState("selected");
        setDisplayedSongs(generateNextDisplayedSongs(displayedSongs()));
      });
    }, 0);
  };

  const currentSong = createMemo(() => {
    if (state() !== "selected") return null;

    return displayedSongs()?.at(SONGS_BEFORE_AFTER)?.song ?? null;
  });

  const currentMatchup = createMemo(() => versusStore.state().matchups[0] ?? null);

  const [jokers, setJokers] = createSignal<[number, number]>([versusStore.settings()?.jokers ?? 0, versusStore.settings()?.jokers ?? 0]);

  const reroll = (player: 0 | 1) => {
    if (state() !== "selected") return;

    const currentJokers = jokers()[player];
    if (currentJokers <= 0) return;

    setJokers((jokers) => {
      const newJokers: [number, number] = [...jokers];
      newJokers[player] = currentJokers - 1;
      return newJokers;
    });

    selectNextSong();
  };


  useNavigation({
    onKeydown: (event) => {
      if (event.action === "back") {
        onBack();
      } else if (event.action === "joker-1") {
        reroll(0);
      } else if (event.action === "joker-2") {
        reroll(1);
      }
    },
  });

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title={t("party.versus.title")} onBack={onBack} />}
      footer={<KeyHints hints={["back", "confirm"]} />}
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
            <Show when={currentSong()} keyed>
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
      <div class="grid flex-grow grid-cols-[2fr_5fr] items-center">
        <div>
          highscore
          <button type="button" class="cursor-pointer" onClick={selectNextSong}>
            test
          </button>
        </div>
        <div class="mask-x-from-99% mask-x-to-100% flex w-full flex-col items-center justify-center gap-14 py-4">
          <Show when={currentMatchup()}>
            {(matchup) => (
              <MatchupPlayerDisplay
                player={matchup()[0]}
                colorName={settingsStore.microphones()[0]?.color ?? "blue"}
                jokers={jokers()[0]}
                onReroll={() => reroll(0)}
              />
            )}
          </Show>
          <div
            class="pointer-events-none flex transform-gpu justify-center will-change-transform"
            style={{
              transform: state() === "animating" ? `translateX(-${((1 + SONGS_BETWEEN) * 100) / TOTAL_SONG_ITEMS}%)` : "",
              transition: state() === "animating" ? "transform 3s cubic-bezier(0.42, 0, 0.4, 1)" : "",
              width: `${(TOTAL_SONG_ITEMS / SONGS_ON_SCREEN) * 100}%`,
            }}
            onTransitionEnd={onTransitionEnd}
          >
            <Show when={displayedSongs()}>
              {(data) => (
                <>
                  <For each={times(PADDING)}>{() => <div class="flex-shrink-0" style={{ width: `${100 / TOTAL_SONG_ITEMS}%` }} />}</For>
                  <Key each={data()} by={(item) => item.id}>
                    {(songItem, index) => (
                      <div
                        onTransitionEnd={(event) => event.stopPropagation()}
                        class="relative aspect-square flex-shrink-0 transform p-2 transition-transform duration-250"
                        style={{ width: `${100 / TOTAL_SONG_ITEMS}%` }}
                        classList={{
                          "scale-130": state() === "selected" && index() === SONGS_BEFORE_AFTER,
                          "-translate-x-1/8": state() === "selected" && index() < SONGS_BEFORE_AFTER,
                          "translate-x-1/8": state() === "selected" && index() > SONGS_BEFORE_AFTER,
                        }}
                      >
                        <Show when={songItem().song}>{(song) => <SongCard song={song()} />}</Show>

                        <div
                          class="absolute inset-0 p-2 opacity-0 transition-opacity duration-250"
                          classList={{
                            "opacity-80": state() === "selected" && index() === SONGS_BEFORE_AFTER,
                          }}
                        >
                          <div class="gradient-party h-full w-full rounded-lg bg-gradient-to-r p-4 text-center" />
                        </div>
                        <div
                          class="absolute inset-0 p-2 opacity-0 transition-opacity duration-250"
                          classList={{
                            "opacity-100": state() === "selected" && index() === SONGS_BEFORE_AFTER,
                          }}
                        >
                          <div class="flex h-full w-full flex-col items-center justify-center p-4 text-center">
                            <p class="font-bold text-white">{songItem().song?.title}</p>
                            <p>-</p>
                            <p class="text-sm text-white">{songItem().song?.artist}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </Key>
                </>
              )}
            </Show>
          </div>
          <Show when={currentMatchup()}>
            {(matchup) => (
              <MatchupPlayerDisplay
                player={matchup()[1]}
                colorName={settingsStore.microphones()[1]?.color ?? "red"}
                jokers={jokers()[1]}
                onReroll={() => reroll(1)}
              />
            )}
          </Show>
        </div>
      </div>
    </Layout>
  );
}

interface SongCardProps {
  song: LocalSong;
  class?: string;
}

function SongCard(props: SongCardProps) {
  return (
    <div
      class="h-full w-full overflow-hidden rounded-lg shadow-xl"
      classList={{
        [props.class ?? ""]: true,
      }}
    >
      <img loading="lazy" src={props.song.coverUrl} alt={props.song.title} class="h-full w-full object-cover" />
    </div>
  );
}

interface MatchupPlayerDisplayProps {
  player: User;
  colorName: string;
  class?: string;
  jokers: number;
  onReroll: () => void;
}

function MatchupPlayerDisplay(props: MatchupPlayerDisplayProps) {
  return (
    <div
      class={`flex w-96 flex-row items-center gap-4 rounded-lg p-4 text-white shadow-lg ${props.class ?? ""}`}
      style={{
        background: `linear-gradient(90deg, ${getColorVar(props.colorName, 600)}, ${getColorVar(props.colorName, 500)})`,
      }}
    >
      <div class="flex flex-grow flex-row items-center gap-4">
        <Avatar user={props.player} />
        <div class="truncate font-bold text-xl">{props.player.username}</div>
      </div>
      <div class="flex flex-row items-center gap-2">
        <button type="button" class="cursor-pointer transition-all hover:opacity-75 active:scale-95 " onClick={props.onReroll}>
          <IconDices class="text-lg" />
        </button>
        <p class="">{props.jokers}</p>
      </div>
    </div>
  );
}
