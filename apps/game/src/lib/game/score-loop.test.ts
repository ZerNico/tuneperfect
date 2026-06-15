import { describe, expect, it } from "vitest";

import { beatsToProcess } from "./score-loop";

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
