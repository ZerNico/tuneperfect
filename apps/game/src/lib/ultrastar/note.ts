import type { Note } from "~/lib/native/types.gen";

export type { Note };

/** Rap and RapGolden: scored on any sung pitch, not the note's pitch. */
export function isRap(note: Note) {
  return note.type === "Rap" || note.type === "RapGolden";
}

/** Golden and RapGolden: worth double. */
export function isGolden(note: Note) {
  return note.type === "Golden" || note.type === "RapGolden";
}
