import type { Note } from "../ultrastar/note";
import type { ProcessedBeat } from "./player-context";

/** Consecutive processed beats of one note sung at the same pitch, drawn as one bar. */
export interface ProcessedNoteGroup extends ProcessedBeat {
  /** First beat of the group. */
  beat: number;
  note: Note;
  length: number;
  row: number;
  /** 1-based grid column within the phrase. */
  column: number;
  rawMidiNotes: number[];
}

/**
 * Adds the next processed beat to `groups` (beats must come in ascending order): it extends the
 * last group or starts a new one. Only the last element is ever replaced, never mutated, so
 * earlier groups keep their identity and whoever renders them sees no change.
 */
export function addProcessedBeat(
  groups: ProcessedNoteGroup[],
  beatNumber: number,
  beat: ProcessedBeat,
  phraseStartBeat: number,
  getRow: (beat: ProcessedBeat) => number,
) {
  const lastIndex = groups.length - 1;
  const lastGroup = groups[lastIndex];

  const extendsLastGroup =
    lastGroup !== undefined &&
    !beat.isFirstInNote && // A note always starts a new group
    lastGroup.midiNote === beat.midiNote && // The pitch has not changed
    lastGroup.beat + lastGroup.length === beatNumber; // There's no time gap

  if (extendsLastGroup) {
    groups[lastIndex] = {
      ...lastGroup,
      length: lastGroup.length + 1,
      rawMidiNotes: [...lastGroup.rawMidiNotes, beat.rawMidiNote],
    };
    return;
  }

  groups.push({
    ...beat,
    beat: beatNumber,
    length: 1,
    row: getRow(beat),
    column: beatNumber - phraseStartBeat + 1,
    rawMidiNotes: [beat.rawMidiNote],
  });
}
