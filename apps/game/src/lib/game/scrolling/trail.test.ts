import { describe, expect, it } from "vitest";

import { buildTrail, medianOfThree, placeSungPitch, type TrailPoint } from "./trail";

describe("placeSungPitch", () => {
  it("snaps onto the note within tolerance, in any octave", () => {
    expect(placeSungPitch(61.4, 60, 60, 2)).toBe(60);
    expect(placeSungPitch(73.5, 60, 60, 2)).toBe(60);
    expect(placeSungPitch(48.2, 60, 60, 2)).toBe(60);
  });

  it("shows a miss in the octave next to the note", () => {
    expect(placeSungPitch(64, 60, 60, 2)).toBe(64);
    expect(placeSungPitch(64 + 24, 60, 60, 2)).toBe(64);
    expect(placeSungPitch(56 - 12, 60, 60, 2)).toBe(56);
  });

  it("follows the tolerance of the difficulty", () => {
    expect(placeSungPitch(61, 60, 60, 0.5)).toBe(61);
  });

  it("uses the camera's octave between notes", () => {
    expect(placeSungPitch(50, undefined, 61, 2)).toBe(62);
  });
});

describe("buildTrail", () => {
  const noteA = {};
  const noteB = {};
  const point = (time: number, midi: number, note: unknown = noteA): TrailPoint => ({ time, midi, note });

  it("fades with age and keeps only the last span", () => {
    const trail = buildTrail([point(0, 60), point(300, 60), point(600, 60)], 600, 600);
    expect(trail.map((s) => [s.fromTime, s.toTime, s.freshness])).toEqual([
      [0, 300, 0.5],
      [300, 600, 1],
    ]);
    expect(buildTrail([point(0, 60), point(10, 60)], 1000, 600)).toEqual([]);
  });

  it("breaks between notes and on jumps", () => {
    const trail = buildTrail([point(0, 60), point(10, 60, noteB), point(20, 60, noteB), point(30, 64, noteB)], 30, 600);
    expect(trail.map((s) => s.fromTime)).toEqual([10]);
  });
});

describe("medianOfThree", () => {
  it("drops a single-frame slip", () => {
    const values = [60, 60, 72, 60, 60];
    expect(values.map((_, i) => medianOfThree(values, i))).toEqual([60, 60, 60, 60, 60]);
  });
});
