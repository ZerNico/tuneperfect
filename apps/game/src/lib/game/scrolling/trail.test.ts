import { describe, expect, it } from "vitest";

import { buildTrail, carryToNow, placeSungPitch, steadyPitches, type TrailPoint } from "./trail";

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

  it("eases off the note just outside the tolerance", () => {
    expect(placeSungPitch(63, 60, 60, 2)).toBe(61.5);
    expect(placeSungPitch(64, 60, 60, 2)).toBe(64);
  });

  it("follows the tolerance of the difficulty", () => {
    expect(placeSungPitch(61, 60, 60, 0.5)).toBe(61);
  });

  it("uses the fallback's octave without a note", () => {
    expect(placeSungPitch(50, undefined, 61, 2)).toBe(62);
  });
});

describe("buildTrail", () => {
  const point = (time: number, midi: number): TrailPoint => ({ time, midi });

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

  it("marks the parts sung on the note", () => {
    const on = (time: number): TrailPoint => ({ time, midi: 60, on: true });
    const trail = buildTrail([point(0, 60), on(10), on(20)], 20, 600);
    expect(trail.map((s) => s.on)).toEqual([false, true]);
  });

  it("breaks on jumps", () => {
    const trail = buildTrail([point(0, 60), point(10, 60), point(20, 64), point(30, 64)], 30, 600);
    expect(trail.map((s) => s.fromTime)).toEqual([0, 20]);
  });
});

describe("steadyPitches", () => {
  it("drops glitches and octave slips", () => {
    const steady = steadyPitches([60, 72, 60, 60, 47.8, 60]);
    for (const value of steady) expect(value).toBeCloseTo(60);
  });

  it("keeps the values in between, so slides stay smooth", () => {
    const slide = Array.from({ length: 11 }, (_, i) => 60 + i * 0.2);
    const steady = steadyPitches(slide);
    expect(steady[5]).toBeCloseTo(61);
    for (let i = 1; i < steady.length; i++) expect(steady[i]!).toBeGreaterThan(steady[i - 1]!);
  });

  it("doesn't reach across silence", () => {
    expect(steadyPitches([64, 64, Number.NaN, 60, 61, 62])[3]).toBeCloseTo(61);
  });
});

describe("carryToNow", () => {
  it("carries the trail on to the cursor without breaking it", () => {
    const points: TrailPoint[] = [
      { time: 760, midi: 60 },
      { time: 770, midi: 61 },
    ];
    carryToNow(points, 1000, 62);

    expect(points.at(-1)).toEqual({ time: 1000, midi: 62 });
    const segments = buildTrail(points, 1000, 600);
    expect(segments).toHaveLength(points.length - 1);
    expect(segments.at(-1)?.freshness).toBe(1);
  });
});
