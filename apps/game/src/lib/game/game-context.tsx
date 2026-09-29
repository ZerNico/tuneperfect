import { type Accessor, createContext, type Setter, useContext } from "solid-js";

import type { Song } from "~/lib/ultrastar/song";
import type { PlayerStats, Score } from "~/stores/round";

export interface GameContextValue {
  start: () => Promise<boolean>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  skip: () => void;
  started: Accessor<boolean>;
  playing: Accessor<boolean>;
  ms: Accessor<number>;
  beat: Accessor<number>;
  song: Accessor<Song | undefined>;
  currentTime: Accessor<number>;
  duration: Accessor<number>;
  scores: Accessor<Score[]>;
  addScore: (index: number, type: "normal" | "golden" | "bonus", value: number) => void;
  stats: Accessor<PlayerStats[]>;
  setPlayerStats: (index: number, stats: PlayerStats) => void;
  preferInstrumental: Accessor<boolean>;
  setPreferInstrumental: Setter<boolean>;
  pitches: Accessor<(number | null)[]>;
  playerCount: Accessor<number>;
}

export const GameContext = createContext<GameContextValue>();

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }

  return context;
}
