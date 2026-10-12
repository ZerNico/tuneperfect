import { describe, expect, it } from "vitest";

import { buildTrail, carryToNow, placeSungPitch, steadyPitch, type TrailPoint } from "./trail";

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
    const points = Array.from({ length: 61 }, (_, i) => point(i * 10, 60));
    const trail = buildTrail(points, 600, 600);
    expect(trail).toHaveLength(60);
    expect(trail[0]?.freshness).toBeCloseTo(1 / 60);
    expect(trail.at(-1)?.freshness).toBe(1);
    expect(buildTrail([point(0, 60), point(10, 60)], 1000, 600)).toEqual([]);
  });

  it("breaks where nothing was sung", () => {
    const trail = buildTrail([point(0, 60), point(10, 60), point(200, 60), point(210, 60)], 210, 600);
    expect(trail.map((s) => s.fromTime)).toEqual([0, 200]);
  });

  it("breaks between notes and on jumps", () => {
    const trail = buildTrail([point(0, 60), point(10, 60, noteB), point(20, 60, noteB), point(30, 64, noteB)], 30, 600);
    expect(trail.map((s) => s.fromTime)).toEqual([10]);
  });
});

describe("steadyPitch", () => {
  it("drops glitches and octave slips, on the nearest semitone", () => {
    const values = [60.2, 72, 59.9, 60.4, 47.8, 60.1];
    expect(values.map((_, i) => steadyPitch(values, i))).toEqual([60, 60, 60, 60, 60, 60]);
  });

  it("doesn't reach across silence", () => {
    expect(steadyPitch([64, 64, Number.NaN, 60, 61.6, 61], 3)).toBe(61);
  });
});

describe("carryToNow", () => {
  it("carries the trail on to the cursor without breaking it", () => {
    const note = {};
    const points: TrailPoint[] = [
      { time: 760, midi: 60, note },
      { time: 770, midi: 61, note },
    ];
    carryToNow(points, 1000, 62);

    expect(points.at(-1)).toEqual({ time: 1000, midi: 62, note });
    const segments = buildTrail(points, 1000, 600);
    expect(segments).toHaveLength(points.length - 1);
    expect(segments.at(-1)?.freshness).toBe(1);
  });
});
