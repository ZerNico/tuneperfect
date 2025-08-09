import type { Score } from "~/stores/round";
import type { Note } from "../ultrastar/note";
import type { Voice } from "../ultrastar/voice";

export const MAX_POSSIBLE_SCORE = 10000;

export function getRelativeScore(score: Score, maxScore: Score) {
  const maxScoreTotal = maxScore.normal + maxScore.golden + maxScore.bonus;
  const absoluteScore = score ?? { normal: 0, golden: 0, bonus: 0 };

  const calculate = (s: number) => (maxScoreTotal > 0 ? (s / maxScoreTotal) * MAX_POSSIBLE_SCORE : 0);

  const relativeScore = {
    normal: calculate(absoluteScore.normal),
    golden: calculate(absoluteScore.golden),
    bonus: calculate(absoluteScore.bonus),
  };

  return relativeScore;
}

export function getNoteScore(note: Note) {
  switch (note.type) {
    case "Normal":
    case "Rap":
      return 10;
    case "Golden":
    case "RapGolden":
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

      if (note.type === "Normal" || note.type === "Rap") {
        score.normal += noteScore;
        score.bonus += note.length;
      } else if (note.type === "Golden" || note.type === "RapGolden") {
        score.golden += noteScore;
        score.bonus += note.length;
      }
    }
  }

  return score;
}
