import type { ReactiveMap } from "@solid-primitives/map";
import { type Accessor, createContext, type JSX, useContext } from "solid-js";
import type { Phrase } from "~/lib/ultrastar/phrase";
import type { Score } from "~/stores/round";
import type { Microphone } from "~/stores/settings";
import type { User } from "../types";
import type { Note } from "../ultrastar/note";
export interface PlayerContextValue {
  index: Accessor<number>;
  phraseIndex: Accessor<number>;
  phrase: Accessor<Phrase | undefined>;
  nextPhrase: Accessor<Phrase | undefined>;
  microphone: Accessor<Microphone>;
  delayedBeat: Accessor<number>;
  processedBeats: ReactiveMap<
    number,
    { note: Note; midiNote: number; rawMidiNote: number; isFirstInPhrase: boolean; isFirstInNote: boolean }
  >;
  addScore: (type: "normal" | "golden" | "bonus", value: number) => void;
  score: Accessor<Score>;
  maxScore: Accessor<{ normal: number; golden: number; bonus: number }>;
  player: Accessor<User | null>;
}

export const PlayerContext = createContext<PlayerContextValue>();

export function PlayerProvider(props: { value: PlayerContextValue; children: JSX.Element }) {
  return <PlayerContext.Provider value={props.value}>{props.children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }

  return context;
}
