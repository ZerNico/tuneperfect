import { createSignal } from "solid-js";
import { type Matchup, generateMatchups } from "~/lib/party/versus/matchup";
import type { User } from "~/lib/types";
import type { Song } from "~/lib/ultrastar/song";

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
}

function createVersusStore() {
  const [settings, setSettings] = createSignal<Settings>();
  const [state, setState] = createSignal<State>({
    players: [],
    rounds: {},
    matchups: [],
    playedSongs: [],
  });

  const startRound = (settings: Settings, players: User[]) => {
    setSettings(settings);
    setState({
      players,
      rounds: {},
      matchups: generateMatchups(players),
      playedSongs: [],
    });

    console.log(state().matchups);
  };

  return {
    settings,
    state,
    setSettings,
    setState,
    startRound,
  };
}

export const versusStore = createVersusStore();
