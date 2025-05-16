import { createSignal } from "solid-js";
import { type Matchup, generateMatchups } from "~/lib/party/versus/matchup";
import type { User } from "~/lib/types";
import type { Song } from "~/lib/ultrastar/song";
import type { Score } from "../round";

export interface Settings {
  jokers: number;
}

export interface Round {
  result: "win" | "lose" | "draw";
  score: Score;
}

export interface State {
  players: User[];
  scores: Record<User["id"], Round>;
  matchups: Matchup[];
  playedSongs: Song[];
}

function createVersusStore() {
  const [settings, setSettings] = createSignal<Settings>();
  const [state, setState] = createSignal<State>({
    players: [],
    scores: {},
    matchups: [],
    playedSongs: [],
  });

  const startRound = (settings: Settings, players: User[]) => {
    setSettings(settings);
    setState({
      players,
      scores: {},
      matchups: generateMatchups(players),
      playedSongs: [],
    });
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
