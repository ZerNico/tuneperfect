import type { Note } from "../ultrastar/note";
import { frequencyToMidi } from "../utils/midi";

export type Difficulty = "easy" | "medium" | "hard";

export function getGapTolerance(difficulty: Difficulty): number {
  switch (difficulty) {
    case "easy":
      return 2;
    case "medium":
      return 1;
    case "hard":
      return 0.5;
    default:
      return 2;
  }
}

const NO_PITCH = -1;

export class PitchProcessor {
  private hasJoker = false;
  private gapTolerance: number;

  constructor(difficulty: Difficulty = "easy") {
    this.gapTolerance = getGapTolerance(difficulty);
  }

  public process(frequency: number, note: Note) {
    const rawMidiNote = frequency > 0 ? frequencyToMidi(frequency) : NO_PITCH;
    const correctedMidiNote = this.applyCorrection(rawMidiNote, note);
    const midiNote = this.applyJoker(correctedMidiNote, note);

    return { midiNote, rawMidiNote };
  }

  private applyCorrection(detectedMidiNote: number, targetNote: Note) {
    if (detectedMidiNote <= 0) {
      return NO_PITCH;
    }

    // Skip pitch correction for rap notes since exact pitch doesn't matter
    if (targetNote.type === "Rap" || targetNote.type === "RapGolden") {
      return Math.round(detectedMidiNote);
    }

    const diff = Math.abs(detectedMidiNote - targetNote.midiNote) % 12;
    const distance = diff > 6 ? 12 - diff : diff;

    return distance <= this.gapTolerance ? targetNote.midiNote : Math.round(detectedMidiNote);
  }

  private applyJoker(detectedMidiNote: number, targetNote: Note) {
    const isRap = targetNote.type === "Rap" || targetNote.type === "RapGolden";
    const isCorrect = isRap ? detectedMidiNote > 0 : detectedMidiNote === targetNote.midiNote;
    const isDropout = detectedMidiNote <= 0;

    if (isCorrect) {
      this.hasJoker = true;
      return detectedMidiNote;
    }

    if (isDropout) {
      this.hasJoker = false;
      return detectedMidiNote;
    }

    if (this.hasJoker) {
      this.hasJoker = false;
      return targetNote.midiNote;
    }

    return detectedMidiNote;
  }
}
