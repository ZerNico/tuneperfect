import { describe, expect, it } from "vitest";

import { cameraAt, planCamera, type PhraseSpan, visiblePitches } from "./camera";

const phrase = (startMs: number, endMs: number, low: number, high: number): PhraseSpan => ({
  startMs,
  endMs,
  low,
  high,
});

describe("planCamera", () => {
  it("starts centred on the first phrase", () => {
    const plan = planCamera([phrase(0, 1000, 58, 64)], 16, 2);
    expect(plan.centres).toEqual([61]);
    expect(plan.moves).toEqual([]);
  });

  it("stays put while phrases fit", () => {
    const plan = planCamera([phrase(0, 1000, 58, 64), phrase(2000, 3000, 55, 66)], 16, 2);
    expect(plan.centres).toEqual([61, 61]);
    expect(plan.moves).toEqual([]);
  });

  it("draws a phrase in the octave nearest the camera", () => {
    const plan = planCamera([phrase(0, 1000, 58, 64), phrase(2000, 3000, 70, 76)], 16, 2);
    expect(plan.shifts).toEqual([0, -12]);
    expect(plan.centres).toEqual([61, 61]);
  });

  it("moves only as far as needed to fit a phrase with its margin", () => {
    // 16 rows around 61 show 53 to 68; with 2 rows of margin, 55 to 66.
    expect(visiblePitches(61, 16)).toEqual({ lowest: 53, highest: 68 });
    const plan = planCamera([phrase(0, 1000, 58, 64), phrase(2000, 3000, 63, 68)], 16, 2);
    expect(plan.shifts).toEqual([0, 0]);
    expect(plan.centres).toEqual([61, 63]);
  });

  it("centres phrases too wide to fit", () => {
    const plan = planCamera([phrase(0, 1000, 58, 64), phrase(2000, 3000, 50, 70)], 16, 2);
    expect(plan.centres[1]).toBe(60);
  });

  it("moves during the gap before the phrase, or just before it when the gap is short", () => {
    const roomy = planCamera([phrase(0, 1000, 58, 64), phrase(3000, 4000, 63, 68)], 16, 2);
    expect(roomy.moves).toEqual([{ fromMs: 1000, toMs: 1900, from: 61, to: 63 }]);

    const tight = planCamera([phrase(0, 1000, 58, 64), phrase(1100, 2000, 63, 68)], 16, 2);
    expect(tight.moves).toEqual([{ fromMs: 850, toMs: 1100, from: 61, to: 63 }]);
  });
});

describe("cameraAt", () => {
  const plan = planCamera([phrase(0, 1000, 58, 64), phrase(3000, 4000, 63, 68), phrase(6000, 7000, 63, 68)], 16, 2);

  it("holds still outside moves", () => {
    expect(cameraAt(plan, -500)).toBe(61);
    expect(cameraAt(plan, 900)).toBe(61);
    expect(cameraAt(plan, 1900)).toBe(63);
    expect(cameraAt(plan, 6500)).toBe(63);
  });

  it("eases through a move, monotonic and smooth at both ends", () => {
    const samples = Array.from({ length: 91 }, (_, i) => cameraAt(plan, 1000 + i * 10));
    for (let i = 1; i < samples.length; i++) expect(samples[i]!).toBeGreaterThanOrEqual(samples[i - 1]!);
    expect(samples[45]).toBeCloseTo(62);
    // Smoothstep starts and ends flat.
    expect(samples[1]! - samples[0]!).toBeLessThan(0.01);
    expect(samples[90]! - samples[89]!).toBeLessThan(0.01);
  });
});
