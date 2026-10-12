import { describe, expect, it } from "vitest";

import { layoutLyrics } from "./lyric-slots";

// 0.1 px per ms; every character 10 px wide; 4 px between syllables.
const layout = (notes: [startMs: number, endMs: number, text: string][]) =>
  layoutLyrics(
    notes.map(([startMs, endMs, text]) => ({ startMs, endMs, text })),
    0.1,
    (text) => text.length * 10,
    4,
  );

describe("layoutLyrics", () => {
  it("puts syllables under their notes when there's room", () => {
    expect(
      layout([
        [0, 500, "Sing "],
        [600, 1000, " it"],
      ]),
    ).toEqual([
      { index: 0, text: "Sing", x: 0, line: 0 },
      { index: 1, text: "it", x: 60, line: 0 },
    ]);
  });

  it("slides a syllable right a little to make room", () => {
    // "Sing" ends at 40 px; the next note starts at 30 px and is 200 px long, so it may slide 80 px.
    const [, second] = layout([
      [0, 300, "Sing"],
      [300, 2300, "it"],
    ]);
    expect(second).toEqual({ index: 1, text: "it", x: 44, line: 0 });
  });

  it("drops to the second line when sliding isn't enough", () => {
    const [, second] = layout([
      [0, 300, "Singing"],
      [300, 400, "it"],
    ]);
    expect(second).toMatchObject({ x: 30, line: 1 });
  });

  it("never overlaps, even in very dense passages", () => {
    const notes: [number, number, string][] = Array.from({ length: 30 }, (_, i) => [i * 50, i * 50 + 50, "word"]);
    const slots = layout(notes);
    for (const line of [0, 1]) {
      const onLine = slots.filter((s) => s.line === line);
      for (let i = 1; i < onLine.length; i++) expect(onLine[i]!.x).toBeGreaterThanOrEqual(onLine[i - 1]!.x + 40 + 4);
    }
    expect(slots).toHaveLength(30);
  });

  it("skips melisma marks and empty syllables", () => {
    expect(
      layout([
        [0, 100, "Oh"],
        [100, 200, "~"],
        [200, 300, " "],
        [300, 400, " yeah"],
      ]).map((s) => s.text),
    ).toEqual(["Oh", "yeah"]);
  });
});
