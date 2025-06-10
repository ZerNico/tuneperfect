import type { Note } from "./note";

export interface Phrase {
  disappearBeat: number;
  notes: Note[];
}
