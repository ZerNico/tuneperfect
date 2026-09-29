import type { ReactiveMap } from "@solid-primitives/map";
import { type Accessor, createContext, useContext } from "solid-js";

import type { Phrase } from "~/lib/ultrastar/phrase";
import type { Score } from "~/stores/round";
import type { Microphone } from "~/stores/settings";

import type { User } from "../types";
import type { Note } from "../ultrastar/note";
import type { ColorShade } from "../utils/color";
import type { PhraseRating } from "../utils/score";

export interface NoteEvent {
  id: number;
  hit: boolean;
  combo: number;
  milestone: boolean;
  brokenCombo: number;
}

/** A scored beat the player sang with some pitch. */
export interface ProcessedBeat {
  note: Note;
  midiNote: number;
  rawMidiNote: number;
  isFirstInNote: boolean;
}

export interface PlayerContextValue {
  phrase: Accessor<Phrase | undefined>;
  microphone: Accessor<Microphone>;
  /** The mic's colour as a CSS variable. */
  micColor: (shade: ColorShade) => string;
  delayedBeat: Accessor<number>;
  processedBeats: ReactiveMap<number, ProcessedBeat>;
  score: Accessor<Score>;
  maxScore: Accessor<{ normal: number; golden: number; bonus: number }>;
  player: Accessor<User | null>;
  phraseRating: Accessor<{ id: number; rating: PhraseRating; bonus: boolean } | null>;
  combo: Accessor<number>;
  /** Fires once per finished (non-freestyle) note. */
  noteEvent: Accessor<NoteEvent | null>;
}

export const PlayerContext = createContext<PlayerContextValue>();

export function usePlayer() {
  const context = useContext(PlayerContext);
  if (!context) {
    throw new Error("usePlayer must be used within a PlayerProvider");
  }

  return context;
}
