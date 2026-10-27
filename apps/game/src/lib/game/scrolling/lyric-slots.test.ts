import { describe, expect, it } from "vitest";

import { layoutLyrics, type LyricNote, syllableText } from "./lyric-slots";

// 0.1 px per ms; every character 10 px wide; lines 20 px; 4 px between syllables. Bars are 20 px
// tall, at `y` (top).
const note = (startMs: number, endMs: number, text: string, y = 0, bar = true): LyricNote => ({
  startMs,
  endMs,
  text,
  top: y,
  bottom: y + 20,
  bar,
});
const layout = (notes: LyricNote[]) =>
  layoutLyrics(notes, { pxPerMs: 0.1, lineHeight: 20, gap: 4 }, (text) => text.length * 10);

const boxes = (notes: LyricNote[]) =>
  layout(notes).map((slot) => ({
    left: slot.x,
    right: slot.x + slot.text.length * 10,
    top: slot.y,
    bottom: slot.y + 20,
  }));

describe("layoutLyrics", () => {
  it("centres syllables under their notes when there's room", () => {
    expect(layout([note(0, 500, "Sing "), note(600, 1000, " it")])).toEqual([
      { index: 0, text: "Sing", x: 5, y: 20 },
      { index: 1, text: "it", x: 70, y: 20 },
    ]);
  });

  it("slides a syllable a little to make room", () => {
    // "Sing" ends at 35 px; "long" would start at 30 px, and may slide 20 px.
    const [, second] = layout([note(0, 300, "Sing"), note(300, 700, "long")]);
    expect(second).toEqual({ index: 1, text: "long", x: 39, y: 20 });
  });

  it("goes above its note when below is taken", () => {
    const [, second] = layout([note(0, 300, "Singing"), note(300, 400, "it")]);
    expect(second).toEqual({ index: 1, text: "it", x: 25, y: -20 });
  });

  it("keeps clear of other notes' bars", () => {
    // The second note sits right where the first one's syllable would go.
    const [first] = layout([note(0, 300, "Sing", 0), note(0, 300, "", 20)]);
    expect(first?.y).toBe(-20);
  });

  it("covers as little as it can in very dense passages", () => {
    const notes = Array.from({ length: 30 }, (_, i) => note(i * 50, i * 50 + 50, "word", (i % 3) * 20));
    const placed = boxes(notes);
    expect(placed).toHaveLength(30);
    let overlapping = 0;
    for (const [i, a] of placed.entries()) {
      for (const b of placed.slice(i + 1)) {
        if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom) overlapping++;
      }
    }
    expect(overlapping).toBeLessThan(30);
  });

  it("drops melisma marks and skips syllables that are only that", () => {
    expect(
      layout([note(0, 100, "Oh"), note(100, 200, "~"), note(200, 300, " "), note(300, 400, "~ye")]).map((s) => s.text),
    ).toEqual(["Oh", "ye"]);
    expect(syllableText(" lo~ve ")).toBe("love");
  });
});
