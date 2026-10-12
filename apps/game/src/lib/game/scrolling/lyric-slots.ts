/** Where a syllable goes under its note. */
export interface LyricSlot {
  /** Index into the notes it was laid out for. */
  index: number;
  text: string;
  /** Left edge in px from the start of the song. */
  x: number;
  /** 0 right under the notes, 1 the line below, for syllables that don't fit on the first. */
  line: 0 | 1;
}

/** How far a syllable may slide right of its note to make room, as a share of the note's length. */
const MAX_PUSH = 0.4;

/**
 * Lays out the syllables under their notes on the scrolling lane: each starts at its note, slides
 * right a little if the previous one is still in the way, drops to a second line if that isn't
 * enough, and as a last resort slides as far as it must. Dense passages stay readable, and the
 * karaoke bars still show the whole line.
 *
 * Melisma marks (`~`) and empty syllables get no slot.
 */
export function layoutLyrics(
  notes: readonly { startMs: number; endMs: number; text: string }[],
  pxPerMs: number,
  measure: (text: string) => number,
  gapPx: number,
): LyricSlot[] {
  const slots: LyricSlot[] = [];
  const lineEnds = [-Infinity, -Infinity];

  for (const [index, note] of notes.entries()) {
    const text = note.text.trim();
    if (text === "" || text === "~") continue;

    const width = measure(text);
    const start = note.startMs * pxPerMs;
    const maxPush = (note.endMs - note.startMs) * pxPerMs * MAX_PUSH;
    const freeFrom = (line: number) => lineEnds[line]! + gapPx;

    let line: 0 | 1;
    let x: number;
    if (freeFrom(0) - start <= maxPush) {
      line = 0;
      x = Math.max(start, freeFrom(0));
    } else if (freeFrom(1) - start <= maxPush) {
      line = 1;
      x = Math.max(start, freeFrom(1));
    } else {
      line = freeFrom(0) <= freeFrom(1) ? 0 : 1;
      x = freeFrom(line);
    }

    lineEnds[line] = x + width;
    slots.push({ index, text, x, line });
  }

  return slots;
}
