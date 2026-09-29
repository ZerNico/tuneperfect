/**
 * A note counts as hit when more than this share of its beats were on pitch.
 * Strictly more: the scoring forgives one wrong beat after a correct one, which
 * alone would otherwise be half of a two-beat note.
 */
export const NOTE_HIT_THRESHOLD = 0.5;

/** Combos shorter than this are not shown and breaking them is not announced. */
export const MIN_VISIBLE_COMBO = 3;

export function isComboMilestone(combo: number) {
  return combo === 10 || combo === 25 || combo === 50 || (combo >= 100 && combo % 100 === 0);
}

export interface NoteOutcome {
  hit: boolean;
  combo: number;
  milestone: boolean;
  /** Length of the combo that this note broke, 0 if none was broken. */
  brokenCombo: number;
}

/**
 * Counts consecutive hit notes. Freestyle notes never reach the tracker, so
 * they neither extend nor break a combo.
 */
export function createComboTracker() {
  let combo = 0;
  let maxCombo = 0;

  const noteFinished = (correctBeats: number, totalBeats: number): NoteOutcome | null => {
    if (totalBeats <= 0) {
      return null;
    }

    if (correctBeats / totalBeats > NOTE_HIT_THRESHOLD) {
      combo++;
      maxCombo = Math.max(maxCombo, combo);
      return { hit: true, combo, milestone: isComboMilestone(combo), brokenCombo: 0 };
    }

    const brokenCombo = combo;
    combo = 0;
    return { hit: false, combo, milestone: false, brokenCombo };
  };

  return {
    noteFinished,
    combo: () => combo,
    maxCombo: () => maxCombo,
  };
}
