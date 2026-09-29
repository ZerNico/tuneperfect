import { createSignal } from "solid-js";

import { generateMatchups, type Matchup } from "~/lib/party/versus/matchup";
import type { User } from "~/lib/types";
import type { LocalSong } from "~/lib/ultrastar/song";
import { toShuffled } from "~/lib/utils/array";

export interface Settings {
  jokers: number;
}

export interface Round {
  result: "win" | "lose" | "draw";
  score: number;
}

export interface State {
  players: User[];
  rounds: Record<User["id"], Round[]>;
  matchups: Matchup[];
  playedSongs: LocalSong[];
  /** Hashes of songs that failed to play (in a round or as the preview); they're never picked again. */
  failedSongs: string[];
  playing: boolean;
}

function createVersusStore() {
  const [settings, setSettings] = createSignal<Settings>();
  const [state, setState] = createSignal<State>({
    players: [],
    rounds: {},
    matchups: [],
    playedSongs: [],
    failedSongs: [],
    playing: false,
  });

  const startRound = (settings: Settings, players: User[]) => {
    setSettings(settings);
    setState({
      players,
      rounds: {},
      matchups: generateMatchups(toShuffled(players)),
      playedSongs: [],
      failedSongs: [],
      playing: true,
    });
  };

  const continueRound = () => {
    setState((state) => ({
      ...state,
      matchups: generateMatchups(toShuffled(state.players)),
    }));
  };

  const addPlayedSong = (song: LocalSong) => {
    setState((state) => ({ ...state, playedSongs: [...state.playedSongs, song] }));
  };

  const markSongFailed = (song: LocalSong) => {
    setState((state) =>
      state.failedSongs.includes(song.hash) ? state : { ...state, failedSongs: [...state.failedSongs, song.hash] },
    );
  };

  return {
    settings,
    state,
    setSettings,
    setState,
    startRound,
    continueRound,
    addPlayedSong,
    markSongFailed,
  };
}

export const versusStore = createVersusStore();
