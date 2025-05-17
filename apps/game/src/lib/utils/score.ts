import type { Score } from "~/stores/round";
import type { Note } from "../ultrastar/note";
import type { Voice } from "../ultrastar/voice";

export const MAX_POSSIBLE_SCORE = 100000;

export function getRelativeScore(score: Score, maxScore: Score) {
  const maxScoreTotal = maxScore.normal + maxScore.golden + maxScore.bonus;
  const absoluteScore = score ?? { normal: 0, golden: 0, bonus: 0 };

  const relativeScore = {
    normal: (absoluteScore.normal / maxScoreTotal) * MAX_POSSIBLE_SCORE,
    golden: (absoluteScore.golden / maxScoreTotal) * MAX_POSSIBLE_SCORE,
    bonus: (absoluteScore.bonus / maxScoreTotal) * MAX_POSSIBLE_SCORE,
  };

  return relativeScore;
}

export function getNoteScore(note: Note) {
  switch (note.type) {
    case "Normal":
      return 10;
    case "Golden":
      return 20;
    default:
      return 0;
  }
}

export function getMaxScore(voice: Voice) {
  const score = {
    normal: 0,
    golden: 0,
    bonus: 0,
  };

  for (const phrase of voice.phrases) {
    for (const note of phrase.notes) {
      const noteScore = getNoteScore(note) * note.length;

      if (note.type === "Normal") {
        score.normal += noteScore;
        score.bonus += 1;
      } else if (note.type === "Golden") {
        score.golden += noteScore;
        score.bonus += 1;
      }
    }
  }

  return score;
}
