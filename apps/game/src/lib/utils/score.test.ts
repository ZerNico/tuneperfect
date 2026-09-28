import { describe, expect, it } from "vitest";

import type { Note } from "~/lib/native/types.gen";
import type { Score } from "~/stores/round";

import type { Voice } from "../ultrastar/voice";
import {
  getMaxScore,
  getNoteScore,
  getPhraseRating,
  getRelativeScore,
  getRoundTotalScore,
  getRoundTotalScores,
  MAX_POSSIBLE_SCORE,
} from "./score";

function makeNote(partial: Partial<Note> & Pick<Note, "type" | "length">): Note {
  return {
    type: partial.type,
    startBeat: partial.startBeat ?? 0,
    length: partial.length,
    text: partial.text ?? "",
    txtPitch: partial.txtPitch ?? 0,
    midiNote: partial.midiNote ?? 0,
  };
}

function makeVoice(notes: Note[]): Voice {
  return { phrases: [{ disappearBeat: 0, notes }] };
}

describe("getPhraseRating", () => {
  it("returns null when total <= 0", () => {
    expect(getPhraseRating(0, 0)).toBe(null);
    expect(getPhraseRating(5, -1)).toBe(null);
  });

  it("returns 'perfect' at ratio >= 1", () => {
    expect(getPhraseRating(100, 100)).toBe("perfect");
    expect(getPhraseRating(150, 100)).toBe("perfect");
  });

  it("returns 'great' at the 0.85 boundary and below 1", () => {
    expect(getPhraseRating(85, 100)).toBe("great");
    expect(getPhraseRating(99, 100)).toBe("great");
  });

  it("returns 'good' just below 0.85 down to the 0.6 boundary", () => {
    expect(getPhraseRating(84, 100)).toBe("good");
    expect(getPhraseRating(60, 100)).toBe("good");
  });

  it("returns 'meh' just below 0.6 down to the 0.3 boundary", () => {
    expect(getPhraseRating(59, 100)).toBe("meh");
    expect(getPhraseRating(30, 100)).toBe("meh");
  });

  it("returns 'boo' below 0.3", () => {
    expect(getPhraseRating(29, 100)).toBe("boo");
    expect(getPhraseRating(0, 100)).toBe("boo");
  });
});

describe("getNoteScore", () => {
  it("scores Normal and Rap notes at 10", () => {
    expect(getNoteScore(makeNote({ type: "Normal", length: 1 }))).toBe(10);
    expect(getNoteScore(makeNote({ type: "Rap", length: 1 }))).toBe(10);
  });

  it("scores Golden and RapGolden notes at 20", () => {
    expect(getNoteScore(makeNote({ type: "Golden", length: 1 }))).toBe(20);
    expect(getNoteScore(makeNote({ type: "RapGolden", length: 1 }))).toBe(20);
  });

  it("scores non-scoring note types at 0", () => {
    expect(getNoteScore(makeNote({ type: "Freestyle", length: 1 }))).toBe(0);
  });
});

describe("getRelativeScore", () => {
  it("returns all zeros when the max score total is 0", () => {
    const score: Score = { normal: 50, golden: 25, bonus: 10 };
    const maxScore: Score = { normal: 0, golden: 0, bonus: 0 };
    expect(getRelativeScore(score, maxScore)).toEqual({ normal: 0, golden: 0, bonus: 0 });
  });

  it("scales each field by (s / total) * MAX_POSSIBLE_SCORE", () => {
    // total = 100, so each field is (s / 100) * 100000 = s * 1000
    const score: Score = { normal: 50, golden: 30, bonus: 20 };
    const maxScore: Score = { normal: 100, golden: 0, bonus: 0 };
    expect(getRelativeScore(score, maxScore)).toEqual({
      normal: 50000,
      golden: 30000,
      bonus: 20000,
    });
  });

  it("uses MAX_POSSIBLE_SCORE of 100000", () => {
    expect(MAX_POSSIBLE_SCORE).toBe(100000);
  });
});

describe("getMaxScore", () => {
  it("sums noteScore*length into normal/golden and length into bonus", () => {
    const voice = makeVoice([makeNote({ type: "Normal", length: 3 }), makeNote({ type: "Golden", length: 2 })]);
    expect(getMaxScore(voice)).toEqual({
      normal: 30, // 10 * 3
      golden: 40, // 20 * 2
      bonus: 5, // 3 + 2
    });
  });

  it("ignores non-scoring note types entirely (no bonus contribution)", () => {
    const voice = makeVoice([makeNote({ type: "Normal", length: 4 }), makeNote({ type: "Freestyle", length: 10 })]);
    expect(getMaxScore(voice)).toEqual({
      normal: 40, // 10 * 4
      golden: 0,
      bonus: 4, // only the Normal note contributes
    });
  });

  it("returns all zeros for a voice with no notes", () => {
    expect(getMaxScore({ phrases: [] })).toEqual({ normal: 0, golden: 0, bonus: 0 });
  });
});

describe("getRoundTotalScores", () => {
  // Anchor voice: max = { normal: 30, golden: 40, bonus: 5 }, total = 75.
  const voice = makeVoice([makeNote({ type: "Normal", length: 3 }), makeNote({ type: "Golden", length: 2 })]);

  it("floors each player's total against the shared voice max", () => {
    const perfect: Score = { normal: 30, golden: 40, bonus: 5 };
    const zero: Score = { normal: 0, golden: 0, bonus: 0 };
    // A perfect score uses the full 75/75 of the max -> MAX_POSSIBLE_SCORE.
    expect(getRoundTotalScores([perfect, zero], voice)).toEqual([MAX_POSSIBLE_SCORE, 0]);
  });

  it("returns an empty array for no players", () => {
    expect(getRoundTotalScores([], voice)).toEqual([]);
  });

  it("returns 0 for an all-zero score", () => {
    expect(getRoundTotalScores([{ normal: 0, golden: 0, bonus: 0 }], voice)).toEqual([0]);
  });
});

describe("getRoundTotalScore", () => {
  it("matches the corresponding entry of getRoundTotalScores", () => {
    const voice = makeVoice([makeNote({ type: "Normal", length: 4 }), makeNote({ type: "Golden", length: 1 })]);
    const scores: Score[] = [
      { normal: 20, golden: 10, bonus: 3 },
      { normal: 40, golden: 20, bonus: 5 },
    ];
    const totals = getRoundTotalScores(scores, voice);
    expect(getRoundTotalScore(scores[0]!, voice)).toBe(totals[0]);
    expect(getRoundTotalScore(scores[1]!, voice)).toBe(totals[1]);
  });
});
