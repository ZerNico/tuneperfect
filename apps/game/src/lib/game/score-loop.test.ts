import { describe, expect, it } from "vitest";

import { beatsToProcess, isMeasuredBeat, lastFinishedBeat } from "./score-loop";

describe("beatsToProcess", () => {
  it("returns the single starting beat from the initial -1 state", () => {
    expect(beatsToProcess(-1, 0)).toEqual([0]);
  });

  it("returns an empty array when the beat has not advanced", () => {
    expect(beatsToProcess(5, 5)).toEqual([]);
  });

  it("processes every skipped beat between updates", () => {
    expect(beatsToProcess(5, 8)).toEqual([6, 7, 8]);
  });

  it("never re-scores beats on a backward jump", () => {
    expect(beatsToProcess(8, 5)).toEqual([]);
  });
});

describe("lastFinishedBeat", () => {
  it("is the beat before the one in progress", () => {
    expect(lastFinishedBeat(10)).toBe(9);
    expect(lastFinishedBeat(10.99)).toBe(9);
  });

  it("works for negative beats before the first note", () => {
    expect(lastFinishedBeat(-0.5)).toBe(-2);
  });
});

describe("isMeasuredBeat", () => {
  it("lets one sample cover the last two finished beats", () => {
    expect(isMeasuredBeat(9, 9)).toBe(true);
    expect(isMeasuredBeat(8, 9)).toBe(true);
  });

  it("treats older beats after a stall as unmeasured", () => {
    expect(isMeasuredBeat(7, 9)).toBe(false);
    expect(isMeasuredBeat(-100, 9)).toBe(false);
  });
});
