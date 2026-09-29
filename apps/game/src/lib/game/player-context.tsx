import type { ReactiveMap } from "@solid-primitives/map";
import { type Accessor, createContext, createMemo, type JSX, useContext } from "solid-js";

import type { Phrase } from "~/lib/ultrastar/phrase";
import type { Score } from "~/stores/round";
import type { Microphone } from "~/stores/settings";

import type { User } from "../types";
import type { Note } from "../ultrastar/note";
import type { PhraseRating } from "../utils/score";

export interface NoteEvent {
  id: number;
  note: Note;
  golden: boolean;
  hit: boolean;
  combo: number;
  milestone: boolean;
  brokenCombo: number;
}

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
  phraseRating: Accessor<{ id: number; rating: PhraseRating; bonus: boolean } | null>;
  combo: Accessor<number>;
  noteResults: ReactiveMap<Note, "hit" | "miss">;
  /** Fires once per finished (non-freestyle) note. */
  noteEvent: Accessor<NoteEvent | null>;
}

export const PlayerContext = createContext<PlayerContextValue>();

export function PlayerProvider(props: { value: PlayerContextValue; children: JSX.Element }) {
  const value = createMemo(() => props.value);

  // oxlint-disable-next-line solid/reactivity
  return <PlayerContext.Provider value={value()}>{props.children}</PlayerContext.Provider>;
}

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }

  return context;
}
