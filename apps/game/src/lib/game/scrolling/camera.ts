/**
 * The scrolling lane's vertical "camera": which pitch sits in the middle of the lane over time.
 *
 * Scoring ignores octaves, so each phrase is drawn in whichever octave is closest to where the
 * camera already is, and the camera only moves when a phrase wouldn't fit, by as little as it
 * takes, easing during the gap before the phrase. Most phrase changes don't move it at all.
 */

/** The pitch range (midi) a phrase spans and when it's sung. */
export interface PhraseSpan {
  startMs: number;
  endMs: number;
  low: number;
  high: number;
}

/** The camera moving from `from` to `to` (centre pitches) between `fromMs` and `toMs`. */
export interface CameraMove {
  fromMs: number;
  toMs: number;
  from: number;
  to: number;
}

export interface CameraPlan {
  /** Per phrase: the semitones (a multiple of 12) it's drawn shifted by. */
  shifts: number[];
  /** Per phrase: the camera's centre while it's sung. */
  centres: number[];
  moves: CameraMove[];
}

/** How long the camera takes to move when the gap allows. */
const MOVE_MS = 900;
/** The shortest move, squeezed in just before the phrase when the gap is shorter. */
const MIN_MOVE_MS = 250;

/** The lowest and highest pitch a lane of `rows` rows shows around `centre`, like `noteRow`. */
export function visiblePitches(centre: number, rows: number): { lowest: number; highest: number } {
  const lowest = centre - Math.floor(rows / 2);
  return { lowest, highest: lowest + rows - 1 };
}

/**
 * Plans the camera for a voice's phrases (in order). `margin` rows stay free above and below a
 * phrase where possible.
 */
export function planCamera(phrases: PhraseSpan[], rows: number, margin: number): CameraPlan {
  const shifts: number[] = [];
  const centres: number[] = [];
  let camera: number | undefined;

  for (const phrase of phrases) {
    const middle = (phrase.low + phrase.high) / 2;
    camera ??= Math.round(middle);

    // The octave putting the phrase nearest the camera; on a tie, the phrase's own.
    let shift = 0;
    for (const candidate of [-24, -12, 12, 24]) {
      if (Math.abs(middle + candidate - camera) < Math.abs(middle + shift - camera)) shift = candidate;
    }
    const low = phrase.low + shift;
    const high = phrase.high + shift;

    const { lowest, highest } = visiblePitches(camera, rows);
    const usableLow = lowest + margin;
    const usableHigh = highest - margin;
    if (high - low > usableHigh - usableLow) {
      // Too wide to fit with margins: centre it, and outlying notes fold by octave.
      camera = Math.round((low + high) / 2);
    } else if (low < usableLow) {
      camera -= usableLow - low;
    } else if (high > usableHigh) {
      camera += high - usableHigh;
    }

    shifts.push(shift);
    centres.push(camera);
  }

  const moves: CameraMove[] = [];
  for (let i = 1; i < phrases.length; i++) {
    const from = centres[i - 1]!;
    const to = centres[i]!;
    if (from === to) continue;

    const previousEnd = phrases[i - 1]!.endMs;
    const start = phrases[i]!.startMs;
    const roomy = start - previousEnd >= MIN_MOVE_MS;
    moves.push({
      fromMs: roomy ? previousEnd : start - MIN_MOVE_MS,
      toMs: roomy ? Math.min(previousEnd + MOVE_MS, start) : start,
      from,
      to,
    });
  }

  return { shifts, centres, moves };
}

/** The camera's centre at `ms`, easing (smoothstep) through moves. */
export function cameraAt(plan: CameraPlan, ms: number): number {
  // The last move that has started.
  let low = 0;
  let high = plan.moves.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (plan.moves[mid]!.fromMs <= ms) low = mid + 1;
    else high = mid;
  }
  const move = plan.moves[low - 1];
  if (!move) return plan.centres[0] ?? 0;
  if (ms >= move.toMs) return move.to;

  const k = (ms - move.fromMs) / (move.toMs - move.fromMs);
  return move.from + (move.to - move.from) * k * k * (3 - 2 * k);
}
