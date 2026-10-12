/**
 * Loudness after ITU-R BS.1770 / EBU R128, the measure ReplayGain 2 normalizes to. Works on
 * blocks: the K-weighted mean square of each channel over a short window, summed over channels.
 */

/** ReplayGain 2's reference: what the local songs' tags normalize to. */
export const REFERENCE_LUFS = -18;

/** Blocks quieter than this are silence and don't count. */
const ABSOLUTE_GATE_LUFS = -70;
/** Blocks this far below the ungated average don't count either (quiet intros, breaks). */
const RELATIVE_GATE_LU = 10;

export function blockLoudness(meanSquare: number): number {
  return -0.691 + 10 * Math.log10(meanSquare);
}

/** Gated loudness of the blocks so far, or `null` while nothing but silence was measured. */
export function integratedLoudness(blocks: readonly number[]): number | null {
  const audible = blocks.filter((block) => block > 0 && blockLoudness(block) > ABSOLUTE_GATE_LUFS);
  if (audible.length === 0) return null;

  const threshold = blockLoudness(mean(audible)) - RELATIVE_GATE_LU;
  const gated = audible.filter((block) => blockLoudness(block) > threshold);
  return blockLoudness(mean(gated));
}

/**
 * The linear gain that brings `lufs` to the reference. Boosts are capped: a quiet sample
 * with loud peaks would clip, and the meter doesn't track peaks.
 */
export function normalizationGain(lufs: number, maxBoostDb = 3): number {
  const db = Math.min(REFERENCE_LUFS - lufs, maxBoostDb);
  return 10 ** (db / 20);
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}
