import { describe, expect, it } from "vitest";

import { beatToMs, beatToMsWithoutGap, msToBeat, msToBeatWithoutGap } from "./bpm";
import type { Song } from "./song";

function makeSong(partial: { bpm: number; gap: number }): Song {
  return { bpm: partial.bpm, gap: partial.gap } as unknown as Song;
}

describe("msToBeatWithoutGap", () => {
  it("converts milliseconds to beats using bpm*4 (bars per minute)", () => {
    const song = makeSong({ bpm: 120, gap: 0 });
    // 120 * 4 * 1000 / 1000 / 60 = 8
    expect(msToBeatWithoutGap(song, 1000)).toBe(8);
  });

  it("returns 0 beats at 0 ms", () => {
    const song = makeSong({ bpm: 120, gap: 0 });
    expect(msToBeatWithoutGap(song, 0)).toBe(0);
  });
});

describe("beatToMsWithoutGap", () => {
  it("converts beats back to milliseconds", () => {
    const song = makeSong({ bpm: 120, gap: 0 });
    expect(beatToMsWithoutGap(song, 8)).toBe(1000);
  });
});

describe("round trip", () => {
  it("beatToMs(msToBeat(x)) is approximately x", () => {
    const song = makeSong({ bpm: 137, gap: 250 });
    for (const x of [0, 500, 1234, 60000]) {
      expect(beatToMs(song, msToBeat(song, x))).toBeCloseTo(x);
    }
  });
});

describe("gap offset", () => {
  it("beatToMs at beat 0 equals the gap", () => {
    const song = makeSong({ bpm: 120, gap: 500 });
    expect(beatToMs(song, 0)).toBe(500);
  });

  it("msToBeat at ms == gap is 0", () => {
    const song = makeSong({ bpm: 120, gap: 500 });
    expect(msToBeat(song, 500)).toBe(0);
  });
});
