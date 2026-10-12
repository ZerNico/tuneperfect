/**
 * Rows of the note lane, for CSS `grid-row`: 1 is the top row, `rowCount` the bottom one. The lane
 * shows `rowCount` semitones around `centre`; notes outside move by octaves until they fit.
 */
export function noteRow(midiNote: number, centre: number, rowCount: number): number {
  const lowest = centre - Math.floor(rowCount / 2);
  const highest = lowest + rowCount - 1;

  let wrapped = midiNote;
  while (wrapped > highest) wrapped -= 12;
  while (wrapped < lowest) wrapped += 12;

  return highest - wrapped + 1;
}

/**
 * The row of a sung pitch: where it fits on the lane, or an octave away from there if that's
 * closer to the note it was sung against. Octaves don't count when judging pitch, so they
 * shouldn't put a sung note far from its target either.
 */
export function sungNoteRow(sungMidiNote: number, targetMidiNote: number, centre: number, rowCount: number): number {
  const target = noteRow(targetMidiNote, centre, rowCount);
  const sung = noteRow(sungMidiNote, centre, rowCount);

  let closest = sung;
  for (const row of [sung - 12, sung + 12]) {
    if (row >= 1 && row <= rowCount && Math.abs(row - target) < Math.abs(closest - target)) {
      closest = row;
    }
  }
  return closest;
}
