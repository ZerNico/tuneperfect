import { describe, expect, it } from "vitest";

import { noteRow, sungNoteRow } from "./note-rows";

describe("noteRow", () => {
  it.each([16, 12])("uses every row of a %i-row lane, 1 at the top", (rowCount) => {
    const centre = 60;
    const rows = Array.from({ length: rowCount }, (_, i) => noteRow(centre - rowCount / 2 + i, centre, rowCount));

    expect(rows).toEqual(Array.from({ length: rowCount }, (_, i) => rowCount - i));
  });

  it("moves notes outside the lane by octaves", () => {
    expect(noteRow(60 + 12, 60, 16)).toBe(noteRow(60, 60, 16));
    expect(noteRow(60 - 24, 60, 16)).toBe(noteRow(60, 60, 16));
  });
});

describe("sungNoteRow", () => {
  it("takes the octave closest to the target", () => {
    // A 16-row lane (58 to 73 here) fits the lowest four pitches twice: 58 at the bottom, 70 near the top.
    const centre = 66;
    const top = noteRow(70, centre, 16);
    const bottom = noteRow(58, centre, 16);
    expect([top, bottom]).toEqual([4, 16]);

    // Sung against a note near the top, either octave shows there…
    expect(sungNoteRow(58, 72, centre, 16)).toBe(top);
    expect(sungNoteRow(70, 72, centre, 16)).toBe(top);
    // …and against one near the bottom, down there.
    expect(sungNoteRow(70, 60, centre, 16)).toBe(bottom);
  });

  it("keeps wrong notes off their target at the edges of the lane", () => {
    // Easy judges anything within 2 semitones as hit, so a miss is at least 2 rows away. Bars
    // are two rows tall: closer than that, they'd touch.
    for (const rowCount of [12, 16]) {
      for (let target = 48; target < 84; target++) {
        for (const miss of [-5, -4, -3, -2, 2, 3, 4, 5]) {
          const centre = 60;
          const distance = Math.abs(
            sungNoteRow(target + miss, target, centre, rowCount) - noteRow(target, centre, rowCount),
          );
          expect(distance, `target ${target}, missed by ${miss}, ${rowCount} rows`).toBeGreaterThanOrEqual(2);
        }
      }
    }
  });
});
