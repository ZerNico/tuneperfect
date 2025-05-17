import { createSignal } from "solid-js";
import { type Matchup, generateMatchups } from "~/lib/party/versus/matchup";
import type { User } from "~/lib/types";
import type { Song } from "~/lib/ultrastar/song";
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
  playedSongs: Song[];
  playing: boolean;
}

function createVersusStore() {
  const [settings, setSettings] = createSignal<Settings>();
  const [state, setState] = createSignal<State>({
    players: [],
    rounds: {},
    matchups: [],
    playedSongs: [],
    playing: false,
  });

  const startRound = (settings: Settings, players: User[]) => {
    setSettings(settings);
    setState({
      players,
      rounds: {},
      matchups: generateMatchups(toShuffled(players)),
      playedSongs: [],
      playing: true,
    });
  };

  const continueRound = () => {
    setState((state) => ({
      ...state,
      matchups: generateMatchups(toShuffled(state.players)),
    }));
  };

  return {
    settings,
    state,
    setSettings,
    setState,
    startRound,
    continueRound,
  };
}

export const versusStore = createVersusStore();
