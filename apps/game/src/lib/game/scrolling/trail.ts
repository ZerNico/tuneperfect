/** One sung pitch on the lane: song time (ms) and midi pitch (fractional), already placed. */
export interface TrailPoint {
  time: number;
  midi: number;
  /** What it was sung against, to break the trail between notes. */
  note: unknown;
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
 * easy. Without a note it goes in the octave nearest `fallback` (the camera's centre).
 */
export function placeSungPitch(
  midi: number,
  noteMidi: number | undefined,
  fallback: number,
  tolerance: number,
): number {
  const reference = noteMidi ?? fallback;
  const folded = midi - 12 * Math.round((midi - reference) / 12);
  if (noteMidi !== undefined && Math.abs(folded - noteMidi) <= tolerance) return noteMidi;
  return folded;
}

/**
 * The trail behind the cursor: the last `spanMs` of placed points as short segments that fade
 * with age. It breaks where nothing was sung, between notes, and on jumps, so it never draws
 * lines across the lane.
 */
export function buildTrail(points: readonly TrailPoint[], now: number, spanMs: number): TrailSegment[] {
  const segments: TrailSegment[] = [];
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1]!;
    const to = points[i]!;
    if (
      to.time < now - spanMs ||
      to.time - from.time > MAX_GAP_MS ||
      to.note !== from.note ||
      Math.abs(to.midi - from.midi) > MAX_STEP
    ) {
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
 * The sung pitch at `i`, steadied for drawing: the median of it and its voiced neighbours (up to
 * two each side, not across silence, marked `NaN`), on the nearest semitone. Glitches, octave
 * slips and vibrato drop out, so the trail runs flat like the notes it follows.
 */
export function steadyPitch(values: readonly number[], i: number): number {
  const window = [values[i]!];
  for (let j = i - 1; j >= i - STEADY_RADIUS && j >= 0 && !Number.isNaN(values[j]!); j--) window.push(values[j]!);
  for (let j = i + 1; j <= i + STEADY_RADIUS && j < values.length && !Number.isNaN(values[j]!); j++) {
    window.push(values[j]!);
  }
  window.sort((a, b) => a - b);
  return Math.round(window[Math.floor(window.length / 2)]!);
}
