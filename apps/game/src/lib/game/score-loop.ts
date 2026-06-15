/**
 * Beats to score since the last update, inclusive: `(lastProcessedBeat, currentBeat]`.
 * Scoring every skipped beat keeps it frame-rate independent. A backward jump
 * returns `[]` so beats are never re-scored.
 */
export function beatsToProcess(lastProcessedBeat: number, currentBeat: number): number[] {
  if (currentBeat <= lastProcessedBeat) {
    return [];
  }

  const out: number[] = [];
  for (let beat = lastProcessedBeat + 1; beat <= currentBeat; beat++) {
    out.push(beat);
  }
  return out;
}
