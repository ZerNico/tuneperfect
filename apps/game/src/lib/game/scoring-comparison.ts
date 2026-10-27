/**
 * Development check that scoring from the pitch stream agrees with the per-beat pitch requests it
 * replaces. With `localStorage["tp.compareScoring"]` set, each player also scores the old way on
 * the side, and a report is logged when the round ends. Remove together with the per-beat path.
 */
export function compareScoringEnabled(): boolean {
  return import.meta.env.DEV && globalThis.localStorage?.getItem("tp.compareScoring") !== null;
}

type Source = "stream" | "legacy";

export interface ScoringComparisonReport {
  player: number;
  /** Beats both scored. */
  beats: number;
  /** Share of those both judged the same. */
  agreement: number;
  streamScore: number;
  legacyScore: number;
}

/** Reports of finished rounds, for reading over CDP. */
export const scoringComparisonReports: ScoringComparisonReport[] = [];

export function createScoringComparison(player: number) {
  const judged = { stream: new Map<number, boolean>(), legacy: new Map<number, boolean>() };
  const scores = { stream: 0, legacy: 0 };

  return {
    beat(source: Source, beat: number, correct: boolean | undefined) {
      if (correct !== undefined) judged[source].set(beat, correct);
    },
    score(source: Source, value: number) {
      scores[source] += value;
    },
    report() {
      let beats = 0;
      let same = 0;
      for (const [beat, correct] of judged.stream) {
        const legacy = judged.legacy.get(beat);
        if (legacy === undefined) continue;
        beats++;
        if (legacy === correct) same++;
      }
      const report: ScoringComparisonReport = {
        player,
        beats,
        agreement: beats > 0 ? same / beats : 1,
        streamScore: scores.stream,
        legacyScore: scores.legacy,
      };
      scoringComparisonReports.push(report);
      console.info("Scoring comparison:", report);
    },
  };
}
