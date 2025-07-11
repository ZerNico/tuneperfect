import { Key } from "@solid-primitives/keyed";
import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { batch, createMemo, createSignal, For, Show } from "solid-js";
import { Transition } from "solid-transition-group";
import { twMerge } from "tailwind-merge";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import SongPlayer from "~/components/song-player";
import TitleBar from "~/components/title-bar";
import Avatar from "~/components/ui/avatar";
import { keyMode, useNavigation } from "~/hooks/navigation";
import { t } from "~/lib/i18n";
import type { User } from "~/lib/types";
import type { LocalSong } from "~/lib/ultrastar/song";
import { getColorVar } from "~/lib/utils/color";
import { times } from "~/lib/utils/loop";
import { getMaxScore, getRelativeScore } from "~/lib/utils/score";
import { type Round, versusStore } from "~/stores/party/versus";
import { roundStore, useRoundActions } from "~/stores/round";
import { settingsStore } from "~/stores/settings";
import { songsStore } from "~/stores/songs";
import IconDices from "~icons/lucide/dices";
import IconHash from "~icons/lucide/hash";
import IconTrophy from "~icons/lucide/trophy";
import IconF1Key from "~icons/sing/f1-key";
import IconF2Key from "~icons/sing/f2-key";
import IconGamepadLB from "~icons/sing/gamepad-lb";
import IconGamepadRB from "~icons/sing/gamepad-rb";

interface SongItem {
  song: LocalSong | null;
  id: string;
}

const SONGS_ON_SCREEN = 5;
const SONGS_BEFORE_AFTER = 3;
const SONGS_BETWEEN = 40;
const PADDING = SONGS_BETWEEN + SONGS_BEFORE_AFTER - 2;
const TOTAL_SONG_ITEMS = PADDING + 2 * SONGS_BEFORE_AFTER + SONGS_BETWEEN + 2;

interface PlayerScore {
  user: User;
  wins: number;
  totalScore: number;
  roundsPlayed: number;
  rank: number;
}

function calculatePlayerScores(players: User[], roundsData: Record<string, Round[]>): PlayerScore[] {
  const calculatedScores: { user: User; wins: number; totalScore: number; roundsPlayed: number }[] = players
    .map((player) => {
      const playerRounds = roundsData[player.id] || [];
      let wins = 0;
      let totalScore = 0;
      const roundsPlayed = playerRounds.length;

      for (const round of playerRounds) {
        if (round.result === "win" || round.result === "draw") {
          wins++;
        }
        totalScore += round.score;
      }
      return { user: player, wins, totalScore, roundsPlayed };
    })
    .sort((a, b) => {
      if (b.wins !== a.wins) {
        return b.wins - a.wins;
      }
      if (b.totalScore !== a.totalScore) {
        return b.totalScore - a.totalScore;
      }
      return 0;
    });

  if (calculatedScores.length === 0) {
    return [];
  }

  const rankedScores: PlayerScore[] = [];
  let rank = 1;
  const firstPlayerScore = calculatedScores[0];
  if (firstPlayerScore) {
    rankedScores.push({ ...firstPlayerScore, rank });
  }

  for (let i = 1; i < calculatedScores.length; i++) {
    const prevScoreItem = calculatedScores[i - 1];
    const currentScoreItem = calculatedScores[i];

    if (prevScoreItem && currentScoreItem) {
      if (
        currentScoreItem.wins < prevScoreItem.wins ||
        (currentScoreItem.wins === prevScoreItem.wins && currentScoreItem.totalScore < prevScoreItem.totalScore)
      ) {
        rank = i + 1;
      }
      rankedScores.push({ ...currentScoreItem, rank });
    }
  }
  return rankedScores;
}

export const Route = createFileRoute("/party/versus/")({
  component: VersusComponent,
  loader: async () => {
    const settings = roundStore.settings();
    if (roundStore.settings()?.returnTo !== "/party/versus") return;

    const song = settings?.song;
    if (!song) return;

    versusStore.setState((state) => ({
      ...state,
      playedSongs: [...state.playedSongs, song],
    }));

    const voice = settings?.song?.voices[0];
    const players = settings?.players ?? [];
    const scores = roundStore.scores();

    if (scores.length !== 2 || !voice || players.length !== 2) {
      console.warn("Conditions not met for processing round results:", { settings, voice, players, scores });
      return;
    }

    const totalScores = scores.map((score) => {
      const maxScore = getMaxScore(voice);
      const relativeScore = getRelativeScore(score, maxScore);
      return Math.floor(relativeScore.normal + relativeScore.golden + relativeScore.bonus);
    });

    if (totalScores.every((score) => score === 0)) {
      console.warn("All scores are zero, skipping round result processing.");
      return;
    }

    batch(() => {
      const newRounds = { ...versusStore.state().rounds };

      for (const [index, player] of players.entries()) {
        if (!player) continue;

        const otherIndex = 1 - index; // Simplified way to get other index (0 or 1)
        const currentScore = totalScores[index];
        const otherScore = totalScores[otherIndex];

        if (typeof currentScore === "undefined" || typeof otherScore === "undefined") continue;

        const result: Round["result"] = currentScore > otherScore ? "win" : currentScore < otherScore ? "lose" : "draw";

        const round: Round = {
          result,
          score: currentScore,
        };

        const playerRounds = newRounds[player.id] ?? [];
        newRounds[player.id] = [...playerRounds, round];
      }

      versusStore.setState((state) => ({
        ...state,
        rounds: newRounds,
        matchups: state.matchups.slice(1),
      }));

      roundStore.reset();
    });
  },
});

function VersusComponent() {
  const navigate = useNavigate();
  const roundActions = useRoundActions();
  const onBack = () => navigate({ to: "/party/versus/settings" });

  const availableSongs = createMemo(() => {
    return songsStore.songs().filter((song) => song.voices.length === 1);
  });

  const getRandomSong = () => {
    return availableSongs()[Math.floor(Math.random() * availableSongs().length)];
  };

  const getRandomSongWithoutDuplicates = (playedSongs: LocalSong[]) => {
    const filteredSongs = availableSongs().filter((song) => !playedSongs.includes(song));
    // fallback to random song if no songs are left
    return filteredSongs[Math.floor(Math.random() * filteredSongs.length)] ?? getRandomSong();
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

    const selectedSong = displayedSongs[SONGS_BEFORE_AFTER]?.song;
    if (!selectedSong) {
      return null;
    }

    for (const _ of times(SONGS_BETWEEN - SONGS_BEFORE_AFTER)) {
      const song = getRandomSong();
      if (!song) return null;
      displayedSongs.push({ song, id: generateUUID() });
    }

    const nextPlayedSongs = versusStore.state().playedSongs;

    const next = getRandomSongWithoutDuplicates([...nextPlayedSongs, selectedSong]);
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
    if (state() !== "selected" || versusStore.state().matchups.length === 0) return null;
    return displayedSongs()?.at(SONGS_BEFORE_AFTER)?.song ?? null;
  });

  const currentMatchup = createMemo(() => versusStore.state().matchups[0] ?? null);

  const [jokers, setJokers] = createSignal<[number, number]>([
    versusStore.settings()?.jokers ?? 0,
    versusStore.settings()?.jokers ?? 0,
  ]);

  const winners = createMemo(() => {
    const players = versusStore.state().players;
    const roundsData = versusStore.state().rounds;
    const rankedScores = calculatePlayerScores(players, roundsData);
    return rankedScores.filter((score) => score.rank === 1).map((score) => score.user);
  });

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
      }

      if (event.action === "joker-1") {
        reroll(0);
      } else if (event.action === "joker-2") {
        reroll(1);
      } else if (event.action === "confirm") {
        startRound();
      }
    },
  });

  const startRound = () => {
    const song = currentSong();
    if (!song) return;

    const players = versusStore.state().matchups[0];
    if (!players) return;

    roundActions.startRound({ song, players, voices: [0, 0], returnTo: "/party/versus" });
  };

  const menuItems: MenuItem[] = [
    {
      type: "button",
      label: t("party.versus.continue"),
      action: () => {
        versusStore.continueRound();
      },
    },
    {
      type: "button",
      label: t("party.versus.exit"),
      action: onBack,
    },
  ];

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
      <div class="grid flex-grow grid-cols-[2fr_5fr] items-center gap-4">
        <div>
          <VersusHighscoreList />
        </div>
        <Show
          when={currentMatchup()}
          fallback={<VersusEndScreen winners={winners()} menuItems={menuItems} onBack={onBack} t={t} />}
        >
          {(matchup) => (
            <div class="mask-x-from-99% mask-x-to-100% flex w-full flex-col items-center justify-center gap-14 py-4">
              <MatchupPlayerDisplay
                player={matchup()[0]}
                colorName={settingsStore.microphones()[0]?.color ?? "blue"}
                jokers={jokers()[0]}
                onReroll={() => reroll(0)}
                playerIndex={0}
              />

              <div
                class="pointer-events-none flex transform-gpu justify-center will-change-transform"
                style={{
                  transform:
                    state() === "animating" ? `translateX(-${((1 + SONGS_BETWEEN) * 100) / TOTAL_SONG_ITEMS}%)` : "",
                  transition: state() === "animating" ? "transform 3s cubic-bezier(0.42, 0, 0.4, 1)" : "",
                  width: `${(TOTAL_SONG_ITEMS / SONGS_ON_SCREEN) * 100}%`,
                }}
                onTransitionEnd={onTransitionEnd}
              >
                <Show when={displayedSongs()}>
                  {(data) => (
                    <>
                      <For each={times(PADDING)}>
                        {() => <div class="flex-shrink-0" style={{ width: `${100 / TOTAL_SONG_ITEMS}%` }} />}
                      </For>
                      <Key each={data()} by={(item) => item.id}>
                        {(songItem, index) => (
                          <button
                            type="button"
                            onTransitionEnd={(event) => event.stopPropagation()}
                            class="relative aspect-square w-full flex-shrink-0 transform p-2 transition-transform duration-250"
                            style={{ width: `${100 / TOTAL_SONG_ITEMS}%` }}
                            classList={{
                              "pointer-events-auto scale-130 cursor-pointer active:scale-125":
                                state() === "selected" && index() === SONGS_BEFORE_AFTER,
                              "-translate-x-1/8": state() === "selected" && index() < SONGS_BEFORE_AFTER,
                              "translate-x-1/8": state() === "selected" && index() > SONGS_BEFORE_AFTER,
                            }}
                            onClick={startRound}
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
                          </button>
                        )}
                      </Key>
                    </>
                  )}
                </Show>
              </div>
              <MatchupPlayerDisplay
                player={matchup()[1]}
                colorName={settingsStore.microphones()[1]?.color ?? "red"}
                jokers={jokers()[1]}
                onReroll={() => reroll(1)}
                playerIndex={1}
              />
            </div>
          )}
        </Show>
      </div>
    </Layout>
  );
}

interface VersusEndScreenProps {
  winners: User[];
  menuItems: MenuItem[];
  onBack: () => void;
  t: typeof t;
}

function VersusEndScreen(props: VersusEndScreenProps) {
  return (
    <div class="flex h-full w-full flex-col items-center justify-center">
      <div class="flex flex-1 flex-col items-center justify-center">
        <IconTrophy class="text-6xl" />
        <Show when={props.winners.length > 0}>
          <p class="gradient-party bg-gradient-to-b bg-clip-text text-center font-bold text-6xl text-transparent">
            <Show when={props.winners.length === 1} fallback={props.t("party.versus.draw")}>
              {props.winners[0]?.username} {props.t("party.versus.wins")}!
            </Show>
          </p>
        </Show>
      </div>
      <Menu gradient="gradient-party" class="!h-auto" items={props.menuItems} onBack={props.onBack} layer={1} />
    </div>
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
      <img loading="lazy" src={props.song.coverUrl ?? ""} alt={props.song.title} class="h-full w-full object-cover" />
    </div>
  );
}

interface MatchupPlayerDisplayProps {
  player: User;
  colorName: string;
  class?: string;
  jokers: number;
  onReroll: () => void;
  playerIndex: 0 | 1;
}

function MatchupPlayerDisplay(props: MatchupPlayerDisplayProps) {
  return (
    <div
      class={`flex w-96 flex-row items-center gap-4 rounded-lg p-4 text-white shadow-lg ${props.class ?? ""}`}
      style={{
        background: `linear-gradient(90deg, ${getColorVar(props.colorName, 600)}, ${getColorVar(props.colorName, 500)})`,
      }}
    >
      <div class="flex flex-grow flex-row items-center gap-4 overflow-hidden">
        <Avatar user={props.player} />
        <div class="truncate font-bold text-xl">{props.player.username}</div>
      </div>
      <div class="flex flex-row items-center gap-2">
        <Show when={props.playerIndex === 0}>
          <Show when={keyMode() === "gamepad"} fallback={<IconF1Key class="text-sm" />}>
            <IconGamepadLB class="text-base" />
          </Show>
        </Show>
        <Show when={props.playerIndex === 1}>
          <Show when={keyMode() === "gamepad"} fallback={<IconF2Key class="text-sm" />}>
            <IconGamepadRB class="text-base" />
          </Show>
        </Show>
        <button
          type="button"
          class="cursor-pointer transition-all hover:opacity-75 active:scale-95 "
          onClick={props.onReroll}
        >
          <IconDices class="text-xl" />
        </button>
        <p class="">{props.jokers}</p>
      </div>
    </div>
  );
}

interface VersusHighscoreListProps {
  class?: string;
}

function VersusHighscoreList(props: VersusHighscoreListProps) {
  const playerScores = createMemo<PlayerScore[]>(() => {
    const players = versusStore.state().players;
    const rounds = versusStore.state().rounds;
    return calculatePlayerScores(players, rounds);
  });

  return (
    <div class={twMerge("relative overflow-hidden", props.class)}>
      <div class="styled-scrollbars h-full overflow-y-auto">
        <div class="flex flex-col gap-2">
          <For each={playerScores()}>
            {(score) => (
              <div class="flex h-7 w-full items-center gap-2 overflow-hidden rounded-lg bg-black/20 pr-4">
                <div
                  class="flex h-full w-10 flex-shrink-0 items-center justify-center text-center"
                  classList={{
                    "bg-yellow-500": score.rank === 1,
                    "bg-white text-black": score.rank !== 1,
                  }}
                >
                  {score.rank}.
                </div>

                <div class="flex flex-grow items-center gap-2 overflow-hidden">
                  <Avatar user={score.user} class="h-6 w-6 flex-shrink-0" />
                  <span class="truncate">{score.user.username || "?"}</span>
                </div>
                <div class="flex flex-shrink-0 flex-row items-center gap-4">
                  <span class="flex flex-shrink-0 flex-row items-center gap-1 text-sm tabular-nums">
                    <IconTrophy />
                    {score.wins} / {score.roundsPlayed}
                  </span>
                  <span class="flex flex-shrink-0 flex-row items-center gap-1 text-sm tabular-nums">
                    <IconHash />
                    {score.totalScore.toLocaleString("en-US", {
                      maximumFractionDigits: 0,
                    })}
                  </span>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
