import { describe, expect, it } from "vitest";

import type { Note, NoteType } from "~/lib/native/types.gen";
import type { Voice } from "~/lib/ultrastar/voice";

import { type ScoringEvents, ScoringSession } from "./scoring";

const note = (startBeat: number, length: number, midiNote = 60, type: NoteType = "Normal"): Note => ({
  type,
  startBeat,
  length,
  text: "",
  txtPitch: 0,
  midiNote,
});

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

function session(voice: Voice, difficulty: "easy" | "medium" | "hard" = "hard") {
  const log = {
    score: { normal: 0, golden: 0, bonus: 0 },
    beats: [] as { beat: number; midiNote: number }[],
    notes: [] as { hit: boolean; combo: number }[],
    phrases: [] as { rating: string; bonus: boolean }[],
  };
  const events: ScoringEvents = {
    score: (type, value) => (log.score[type] += value),
    beat: (beat, processed) => log.beats.push({ beat, midiNote: processed.midiNote }),
    note: (outcome) => log.notes.push({ hit: outcome.hit, combo: outcome.combo }),
    phrase: (rating, bonus) => log.phrases.push({ rating, bonus }),
  };
  return { scoring: new ScoringSession(voice, difficulty, events), log };
}

describe("ScoringSession", () => {
  it("scores correct beats and ignores beats without a note", () => {
    const { scoring, log } = session({ phrases: [{ disappearBeat: 4, notes: [note(0, 2)] }] });

    expect(scoring.scoreBeat(-1, hz(60))).toBeUndefined();
    expect(scoring.scoreBeat(0, hz(60))).toBe(true);
    expect(scoring.scoreBeat(1, hz(62))).toBe(true); // the joker, see below
    expect(log.score.normal).toBe(20);
  });

  it("folds octaves and snaps within the difficulty's tolerance", () => {
    const voice = { phrases: [{ disappearBeat: 4, notes: [note(0, 3)] }] };

    const easy = session(voice, "easy");
    expect(easy.scoring.scoreBeat(0, hz(48 + 2))).toBe(true);

    const hard = session(voice, "hard");
    expect(hard.scoring.scoreBeat(0, hz(72))).toBe(true);
    expect(hard.scoring.scoreBeat(1, -1)).toBe(false);
    expect(hard.scoring.scoreBeat(2, hz(61))).toBe(false);
  });

  describe("joker", () => {
    const voice = { phrases: [{ disappearBeat: 10, notes: [note(0, 8)] }] };

    it("a correct beat grants it and the next wrong beat uses it up", () => {
      const { scoring, log } = session(voice);
      expect(scoring.scoreBeat(0, hz(60))).toBe(true);
      expect(scoring.scoreBeat(1, hz(64))).toBe(true);
      expect(scoring.scoreBeat(2, hz(64))).toBe(false);
      // The joker beat is drawn on the note.
      expect(log.beats.find((b) => b.beat === 1)?.midiNote).toBe(60);
      expect(log.beats.find((b) => b.beat === 2)?.midiNote).toBe(64);
    });

    it("a dropout takes it away", () => {
      const { scoring } = session(voice);
      scoring.scoreBeat(0, hz(60));
      expect(scoring.scoreBeat(1, -1)).toBe(false);
      expect(scoring.scoreBeat(2, hz(64))).toBe(false);
    });

    it("is regained by every correct beat", () => {
      const { scoring } = session(voice);
      scoring.scoreBeat(0, hz(60));
      scoring.scoreBeat(1, hz(64));
      scoring.scoreBeat(2, hz(60));
      expect(scoring.scoreBeat(3, hz(64))).toBe(true);
    });
  });

  it("raps count any pitch, golden notes double", () => {
    const { scoring, log } = session({
      phrases: [{ disappearBeat: 4, notes: [note(0, 1, 60, "Rap"), note(1, 1, 60, "Golden")] }],
    });
    expect(scoring.scoreBeat(0, hz(47))).toBe(true);
    expect(log.beats[0]?.midiNote).toBe(60);
    scoring.scoreBeat(1, hz(60));
    expect(log.score).toEqual({ normal: 10, golden: 20, bonus: 2 });
  });

  it("freestyle beats aren't scored and don't touch the combo", () => {
    const { scoring, log } = session({
      phrases: [{ disappearBeat: 4, notes: [note(0, 1), note(1, 1, 60, "Freestyle"), note(2, 1)] }],
    });
    scoring.scoreBeat(0, hz(60));
    expect(scoring.scoreBeat(1, hz(60))).toBeUndefined();
    scoring.scoreBeat(2, hz(60));
    expect(log.notes).toEqual([
      { hit: true, combo: 1 },
      { hit: true, combo: 2 },
    ]);
  });

  it("rates phrases, gives a bonus above 90% and keeps stats", () => {
    const { scoring, log } = session({
      phrases: [
        { disappearBeat: 4, notes: [note(0, 2), note(2, 2, 60, "Golden")] },
        { disappearBeat: 8, notes: [note(5, 2)] },
      ],
    });
    for (let beat = 0; beat < 4; beat++) scoring.scoreBeat(beat, hz(60));
    scoring.scoreBeat(5, -1);
    scoring.scoreBeat(6, -1);

    expect(log.phrases).toEqual([
      { rating: "perfect", bonus: true },
      { rating: "boo", bonus: false },
    ]);
    expect(log.score.bonus).toBe(4);
    expect(scoring.stats()).toEqual({
      maxCombo: 2,
      notesHit: 2,
      notesTotal: 3,
      goldenNotesHit: 1,
      goldenNotesTotal: 1,
      perfectPhrases: 1,
      phrasesTotal: 2,
    });
  });

  it("starts each note's count fresh when a seek skipped the last beat", () => {
    const { scoring, log } = session({ phrases: [{ disappearBeat: 8, notes: [note(0, 3), note(3, 1)] }] });
    scoring.scoreBeat(0, -1);
    scoring.scoreBeat(3, hz(60));
    expect(log.notes).toEqual([{ hit: true, combo: 1 }]);
  });
});
