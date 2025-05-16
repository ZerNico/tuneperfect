import { Key } from "@solid-primitives/keyed";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { For, Show, createMemo, createSignal } from "solid-js";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import TitleBar from "~/components/title-bar";
import { useNavigation } from "~/hooks/navigation";
import { t } from "~/lib/i18n";
import type { LocalSong } from "~/lib/ultrastar/parser/local";
import { times } from "~/lib/utils/loop";
import { versusStore } from "~/stores/party/versus";
import { songsStore } from "~/stores/songs";

interface SongItem {
  song: LocalSong | null;
  id: string;
}

const SONGS_ON_SCREEN = 5;
const SONGS_BEFORE_AFTER = 3;
const SONGS_BETWEEN = 30;
const PADDING = SONGS_BETWEEN + SONGS_BEFORE_AFTER - 2;
const TOTAL_SONG_ITEMS = PADDING + 2 * SONGS_BEFORE_AFTER + SONGS_BETWEEN + 2;

export const Route = createFileRoute("/party/versus/")({
  component: VersusComponent,
});

function VersusComponent() {
  const navigate = useNavigate();
  const onBack = () => navigate({ to: "/party/versus/settings" });

  useNavigation({
    onKeydown: (event) => {
      if (event.action === "back") {
        onBack();
      }
    },
  });

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
      setState("selected");
      setDisplayedSongs(generateNextDisplayedSongs(displayedSongs()));
    }, 0);
  };

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title={t("party.versus.title")} onBack={onBack} />}
      footer={<KeyHints hints={["back", "confirm"]} />}
    >
      <div class="grid flex-grow grid-cols-[2fr_5fr] items-center">
        <div>
          highscore
          <button type="button" class="cursor-pointer" onClick={selectNextSong}>
            test
          </button>
        </div>
        <div class="mask-x-from-95% mask-x-to-100% flex w-full flex-col items-center justify-center py-10">
          <div
            class="pointer-events-none flex transform-gpu justify-center will-change-transform"
            style={{
              transform: state() === "animating" ? `translateX(-${((1 + SONGS_BETWEEN) * 100) / TOTAL_SONG_ITEMS}%)` : "",
              transition: state() === "animating" ? "transform 3s ease-in-out" : "",
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
                        class="aspect-square flex-shrink-0 transform p-2 transition-transform duration-250"
                        style={{ width: `${100 / TOTAL_SONG_ITEMS}%` }}
                        classList={{
                          "scale-130": state() === "selected" && index() === SONGS_BEFORE_AFTER,
                          "-translate-x-1/8": state() === "selected" && index() < SONGS_BEFORE_AFTER,
                          "translate-x-1/8": state() === "selected" && index() > SONGS_BEFORE_AFTER,
                        }}
                      >
                        <Show when={songItem().song}>{(song) => <SongCard song={song()} />}</Show>
                      </div>
                    )}
                  </Key>
                </>
              )}
            </Show>
          </div>
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
      <img src={props.song.coverUrl} alt={props.song.title} class="h-full w-full object-cover" />
    </div>
  );
}
