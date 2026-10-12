/** One sung pitch on the lane: song time (ms) and midi pitch (fractional), already placed. */
export interface TrailPoint {
  time: number;
  midi: number;
}

export interface TrailSegment {
  fromTime: number;
  fromMidi: number;
  toTime: number;
  toMidi: number;
  /** 1 at the newest end of the trail, 0 where it ends. */
  freshness: number;
}

/** A jump bigger than this, in semitones, breaks the trail instead of drawing a line across. */
const MAX_STEP = 1.2;
/** Points further apart than this, in ms, had silence between them (frames come every 10 ms). */
const MAX_GAP_MS = 35;

/**
 * Where a sung pitch is drawn: in the octave nearest the note it's sung against (octaves don't
 * count when judging), and right on the note when within `tolerance`, like the classic lane on
 * easy, easing off it just outside. Without a note it goes in the octave nearest `fallback` (e.g. the closest note's pitch).
 */
export function placeSungPitch(
  midi: number,
  noteMidi: number | undefined,
  fallback: number,
  tolerance: number,
): number {
  const reference = noteMidi ?? fallback;
  const folded = midi - 12 * Math.round((midi - reference) / 12);
  if (noteMidi === undefined) return folded;
  // Within the tolerance it sits on the note; just outside, it eases off it, so crossing the
  // edge doesn't jump.
  const off = folded - noteMidi;
  const distance = Math.abs(off);
  if (distance <= tolerance) return noteMidi;
  if (distance >= tolerance * 2) return folded;
  return noteMidi + off * ((distance - tolerance) / tolerance);
}

/**
 * The trail behind the cursor: the last `spanMs` of placed points as short segments that fade
 * with age. It breaks where nothing was sung and on jumps (e.g. from one note's pitch to the
 * next), so it never draws lines across the lane.
 */
export function buildTrail(points: readonly TrailPoint[], now: number, spanMs: number): TrailSegment[] {
  const segments: TrailSegment[] = [];
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1]!;
    const to = points[i]!;
    if (to.time < now - spanMs || to.time - from.time > MAX_GAP_MS || Math.abs(to.midi - from.midi) > MAX_STEP) {
      continue;
    }
    segments.push({
      fromTime: from.time,
      fromMidi: from.midi,
      toTime: to.time,
      toMidi: to.midi,
      freshness: Math.max(0, Math.min(1, 1 - (now - to.time) / spanMs)),
    });
  }
  return segments;
}

/**
 * Carries the trail on from its newest point to `midi` at `now` (the cursor), in steps short
 * enough not to break it, so a voice that's only heard with a delay still reaches the now-line.
 */
export function carryToNow(points: TrailPoint[], now: number, midi: number) {
  const latest = points.at(-1);
  if (!latest || latest.time >= now) return;
  const steps = Math.max(1, Math.ceil((now - latest.time) / (MAX_GAP_MS / 2)));
  for (let step = 1; step <= steps; step++) {
    const share = step / steps;
    points.push({
      ...latest,
      time: latest.time + (now - latest.time) * share,
      midi: latest.midi + (midi - latest.midi) * share,
    });
  }
}

/** How many neighbours on each side steady a sung pitch. */
const STEADY_RADIUS = 2;

/**
 * Sung pitches (fractional midi, `NaN` for silence) steadied for drawing: a median over each
 * point and up to two voiced neighbours each side drops glitches and octave slips, then a light
 * average rounds off what's left, so the line glides without stepping. Neither reaches across
 * silence.
 */
export function steadyPitches(values: readonly number[]): number[] {
  const voicedAround = (source: readonly number[], i: number) => {
    const window = [source[i]!];
    for (let j = i - 1; j >= i - STEADY_RADIUS && j >= 0 && !Number.isNaN(source[j]!); j--) window.push(source[j]!);
    for (let j = i + 1; j <= i + STEADY_RADIUS && j < source.length && !Number.isNaN(source[j]!); j++) {
      window.push(source[j]!);
    }
    return window;
  };

  const medians = values.map((value, i) => {
    if (Number.isNaN(value)) return value;
    const window = voicedAround(values, i).sort((a, b) => a - b);
    const middle = window.length / 2;
    return window.length % 2 === 1 ? window[Math.floor(middle)]! : (window[middle - 1]! + window[middle]!) / 2;
  });
  return medians.map((value, i) => {
    if (Number.isNaN(value)) return value;
    const window = voicedAround(medians, i);
    return window.reduce((sum, v) => sum + v, 0) / window.length;
  });
}
