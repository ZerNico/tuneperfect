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

/**
 * The last beat that has finished at `delayedBeat` (the song beat shifted by the mic's delay). A
 * pitch sample covers the audio just before it was taken, so beat N is scored once the delayed
 * beat reaches N + 1, with the sample from the end of beat N.
 */
export function lastFinishedBeat(delayedBeat: number): number {
  return Math.floor(delayedBeat) - 1;
}

/**
 * How many of the most recent finished beats one pitch sample may stand in for. A frame drop can
 * finish two beats at once, and the sample still describes them; after a longer stall (a hidden
 * window keeps the audio running) the older beats were never measured.
 */
export const MAX_BEATS_PER_SAMPLE = 2;

/** Whether `beat` is close enough to `lastFinished` to be scored with the sample taken now. */
export function isMeasuredBeat(beat: number, lastFinished: number): boolean {
  return lastFinished - beat < MAX_BEATS_PER_SAMPLE;
}
