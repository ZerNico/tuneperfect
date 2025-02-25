import { type Accessor, type JSX, createContext, useContext } from "solid-js";
import type { LocalSong } from "~/lib/ultrastar/parser/local";

export interface GameContextValue {
  start: () => void;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  started: Accessor<boolean>;
  playing: Accessor<boolean>;
  ms: Accessor<number>;
  beat: Accessor<number>;
  song: Accessor<LocalSong | undefined>;
  currentTime: Accessor<number>;
  duration: Accessor<number>;
  scores: Accessor<
    {
      note: number;
      golden: number;
      bonus: number;
    }[]
  >;
  addScore: (index: number, type: "note" | "golden" | "bonus", value: number) => void;
}

export const GameContext = createContext<GameContextValue>();

export function GameProvider(props: { value: GameContextValue; children: JSX.Element }) {
  return <GameContext.Provider value={props.value}>{props.children}</GameContext.Provider>;
}

export function useGame() {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGame must be used within a GameProvider");
  }

  return context;
} 