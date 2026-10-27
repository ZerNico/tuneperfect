import type { PitchTimeline } from "~/lib/audio/pitch-timeline";

/**
 * How far before a beat's end its pitch is measured, as a share of the beat: the frames ending in
 * that span cover about what the per-beat analysis did (three overlapping one-beat windows, a
 * third of a beat apart).
 */
const MEASURED_SHARE = 2 / 3;
/** At least two frames, however short the beat. */
const MIN_MEASURED_MS = 20;

/**
 * The pitch (Hz) sung for a beat ending at `endMs` on `timeline`: the median of the voiced frames
 * near its end, or -1 without any. A few frames are enough: each one analyses 2048 samples.
 */
export function beatPitch(timeline: PitchTimeline | undefined, endMs: number, beatMs: number): number {
  if (!timeline) return -1;

  const voiced: number[] = [];
  timeline.forEachInRange(endMs - Math.max(beatMs * MEASURED_SHARE, MIN_MEASURED_MS), endMs, (_time, hz) => {
    if (hz > 0) voiced.push(hz);
  });
  if (voiced.length === 0) return -1;

  voiced.sort((a, b) => a - b);
  const middle = voiced.length >> 1;
  return voiced.length % 2 === 1 ? voiced[middle]! : (voiced[middle - 1]! + voiced[middle]!) / 2;
}
