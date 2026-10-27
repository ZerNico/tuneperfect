import type { PlayerStats } from "~/stores/round";

import { isGolden, isRap, type Note } from "../ultrastar/note";
import type { Voice } from "../ultrastar/voice";
import { getNoteScore, getPhraseRating, type PhraseRating } from "../utils/score";
import { createComboTracker, type NoteOutcome } from "./combo";
import { type Difficulty, PitchProcessor } from "./pitch";
import type { ProcessedBeat } from "./player-context";

export interface ScoringEvents {
  score: (type: "normal" | "golden" | "bonus", value: number) => void;
  /** A beat sung with some pitch, for drawing it. */
  beat: (beat: number, processed: ProcessedBeat) => void;
  /** A (non-freestyle) note finished. */
  note: (outcome: NoteOutcome) => void;
  phrase: (rating: PhraseRating, bonus: boolean) => void;
}

interface BeatInfo {
  note: Note;
  isLastInPhrase: boolean;
  isFirstInNote: boolean;
  isLastInNote: boolean;
}

function beatInfos(voice: Voice | undefined) {
  const beats = new Map<number, BeatInfo>();
  for (const phrase of voice?.phrases ?? []) {
    for (const [noteIndex, note] of phrase.notes.entries()) {
      const isLastNoteInPhrase = noteIndex === phrase.notes.length - 1;
      for (let i = 0; i < note.length; i++) {
        const isLastInNote = i === note.length - 1;
        beats.set(note.startBeat + i, {
          note,
          isLastInPhrase: isLastNoteInPhrase && isLastInNote,
          isFirstInNote: i === 0,
          isLastInNote,
        });
      }
    }
  }
  return beats;
}

/**
 * One player's scoring for a voice: fed each beat's pitch once and in order, it keeps the score,
 * joker, combo, phrase bonus and stats. Where the pitch comes from is up to the caller.
 */
export class ScoringSession {
  private readonly beats: Map<number, BeatInfo>;
  private readonly pitchProcessor: PitchProcessor;
  private readonly combo = createComboTracker();
  private readonly playerStats: PlayerStats = {
    maxCombo: 0,
    notesHit: 0,
    notesTotal: 0,
    goldenNotesHit: 0,
    goldenNotesTotal: 0,
    perfectPhrases: 0,
    phrasesTotal: 0,
  };

  private correctBeats = 0;
  private totalBeats = 0;
  private noteCorrectBeats = 0;
  private noteTotalBeats = 0;

  constructor(
    voice: Voice | undefined,
    difficulty: Difficulty,
    private readonly events: ScoringEvents,
  ) {
    this.beats = beatInfos(voice);
    this.pitchProcessor = new PitchProcessor(difficulty);
  }

  stats(): PlayerStats {
    return { ...this.playerStats, maxCombo: this.combo.maxCombo() };
  }

  /**
   * Scores a beat with the pitch (Hz, or -1 for none) sung for it. Returns whether it was on pitch,
   * or `undefined` for a beat that isn't scored (no note, or freestyle).
   */
  scoreBeat(beat: number, hz: number): boolean | undefined {
    const info = this.beats.get(beat);
    if (!info) return undefined;

    const noteScore = getNoteScore(info.note);

    if (info.isFirstInNote) {
      // A seek can skip a note's last beat; never carry counts into the next note.
      this.noteCorrectBeats = 0;
      this.noteTotalBeats = 0;
    }

    let correct: boolean | undefined;
    if (noteScore > 0) {
      this.totalBeats++;
      this.noteTotalBeats++;

      const { midiNote, rawMidiNote } = this.pitchProcessor.process(hz, info.note);
      const rap = isRap(info.note);
      correct = rap ? midiNote > 0 : midiNote === info.note.midiNote;

      if (correct) {
        this.correctBeats++;
        this.noteCorrectBeats++;
        // noteScore > 0 rules out freestyle, so every other note is normal.
        this.events.score(isGolden(info.note) ? "golden" : "normal", noteScore);
      }

      if (midiNote > 0) {
        this.events.beat(beat, {
          note: info.note,
          midiNote: rap ? info.note.midiNote : midiNote,
          rawMidiNote: rap ? info.note.midiNote : rawMidiNote,
          isFirstInNote: info.isFirstInNote,
        });
      }

      if (info.isLastInNote) this.finishNote(info.note);
    }

    if (info.isLastInPhrase) this.finishPhrase();

    return correct;
  }

  private finishNote(note: Note) {
    const outcome = this.combo.noteFinished(this.noteCorrectBeats, this.noteTotalBeats);
    this.noteCorrectBeats = 0;
    this.noteTotalBeats = 0;
    if (!outcome) return;

    const golden = isGolden(note);
    this.playerStats.notesTotal++;
    if (golden) this.playerStats.goldenNotesTotal++;
    if (outcome.hit) {
      this.playerStats.notesHit++;
      if (golden) this.playerStats.goldenNotesHit++;
    }
    this.events.note(outcome);
  }

  private finishPhrase() {
    const bonus = this.totalBeats > 0 && this.correctBeats / this.totalBeats > 0.9;
    if (bonus) this.events.score("bonus", this.correctBeats);

    const rating = getPhraseRating(this.correctBeats, this.totalBeats);
    if (rating) {
      this.playerStats.phrasesTotal++;
      if (rating === "perfect") this.playerStats.perfectPhrases++;
      this.events.phrase(rating, bonus);
    }

    this.correctBeats = 0;
    this.totalBeats = 0;
  }
}
