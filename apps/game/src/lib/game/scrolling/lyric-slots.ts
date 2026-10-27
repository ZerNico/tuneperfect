/** A note on the track, for laying out its syllable: times in ms, its bar's top and bottom in px. */
export interface LyricNote {
  startMs: number;
  endMs: number;
  text: string;
  top: number;
  bottom: number;
  /** Whether a bar is drawn for it (freestyle notes have none). */
  bar: boolean;
}

/** Where a syllable goes, in track px. */
export interface LyricSlot {
  /** Index into the notes it was laid out for. */
  index: number;
  text: string;
  x: number;
  /** Top of the text. */
  y: number;
}

export interface LyricGeometry {
  pxPerMs: number;
  lineHeight: number;
  /** Space kept around syllables. */
  gap: number;
}

/** How far a syllable may slide off its note's centre to make room, as a share of the note's length. */
const MAX_PUSH = 0.5;
/** Syllables and bars this many places back can still be in the way. */
const LOOKBACK = 24;

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

const overlap = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
  Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));

/** The syllable as shown: melisma marks (`~`) dropped. */
export function syllableText(text: string): string {
  return text.replaceAll("~", "").trim();
}

/**
 * Lays out the syllables on the scrolling lane, clear of the note bars and of each other: each
 * goes centred under its note, or above it when that's in the way, sliding a little to either
 * side if that makes room. When nothing is free (very dense passages), it takes the spot that covers the least; the
 * karaoke bars still show the whole line.
 *
 * Notes must be in time order. Syllables that are only melisma marks get no slot.
 */
export function layoutLyrics(
  notes: readonly LyricNote[],
  geometry: LyricGeometry,
  measure: (text: string) => number,
): LyricSlot[] {
  const { pxPerMs, lineHeight, gap } = geometry;
  const bars: (Box | undefined)[] = notes.map((note) =>
    note.bar
      ? { left: note.startMs * pxPerMs, right: note.endMs * pxPerMs, top: note.top, bottom: note.bottom }
      : undefined,
  );
  const slots: LyricSlot[] = [];
  const placed: Box[] = [];

  for (const [index, note] of notes.entries()) {
    const text = syllableText(note.text);
    if (text === "") continue;

    const width = measure(text);
    const centred = ((note.startMs + note.endMs) / 2) * pxPerMs - width / 2;
    const maxPush = (note.endMs - note.startMs) * pxPerMs * MAX_PUSH;

    // What could be in the way: recent syllables, and bars from a little back to past the push.
    const obstacles: Box[] = placed.slice(-LOOKBACK);
    for (let i = Math.max(0, index - LOOKBACK); i < bars.length; i++) {
      const bar = bars[i];
      if (!bar || i === index) continue;
      if (bar.left > centred + maxPush + width + gap) break;
      obstacles.push(bar);
    }

    const boxAt = (x: number, y: number): Box => ({ left: x, right: x + width, top: y, bottom: y + lineHeight });
    const covered = (box: Box) => {
      const padded = { left: box.left - gap, right: box.right + gap, top: box.top, bottom: box.bottom };
      return obstacles.reduce((sum, obstacle) => sum + overlap(padded, obstacle), 0);
    };

    // Under the note first, then above it; centred, then slid just clear of what's in the way,
    // the smallest slide first.
    let best: { box: Box; covered: number } | undefined;
    for (const y of [note.bottom, note.top - lineHeight]) {
      const xs = [centred];
      for (const obstacle of obstacles) {
        for (const x of [obstacle.right + gap, obstacle.left - gap - width]) {
          if (Math.abs(x - centred) <= maxPush) xs.push(x);
        }
      }
      xs.sort((a, b) => Math.abs(a - centred) - Math.abs(b - centred));
      for (const x of xs) {
        const box = boxAt(x, y);
        const amount = covered(box);
        if (!best || amount < best.covered) best = { box, covered: amount };
        if (amount === 0) break;
      }
      if (best?.covered === 0) break;
    }

    const box = best!.box;
    placed.push(box);
    slots.push({ index, text, x: box.left, y: box.top });
  }

  return slots;
}
