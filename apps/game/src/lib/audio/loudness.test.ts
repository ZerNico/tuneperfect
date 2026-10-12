import { describe, expect, it } from "vitest";

import { blockLoudness, integratedLoudness, normalizationGain, REFERENCE_LUFS } from "./loudness";

/** The block mean square that measures as `lufs`. */
const block = (lufs: number) => 10 ** ((lufs + 0.691) / 10);

describe("loudness", () => {
  it("measures a block", () => {
    expect(blockLoudness(block(-23))).toBeCloseTo(-23);
  });

  it("averages power, not loudness", () => {
    // -10 and -20 LUFS average to -12.6, not -15.
    expect(integratedLoudness([block(-10), block(-20)])).toBeCloseTo(-12.6, 1);
  });

  it("ignores silence and quiet passages", () => {
    const song = Array.from({ length: 20 }, () => block(-9));
    expect(integratedLoudness([0, block(-80), block(-40), ...song])).toBeCloseTo(-9);
  });

  it("has nothing to say about silence", () => {
    expect(integratedLoudness([])).toBeNull();
    expect(integratedLoudness([0, block(-75)])).toBeNull();
  });

  it("turns loud samples down to the reference", () => {
    expect(normalizationGain(-8)).toBeCloseTo(10 ** (-10 / 20));
    expect(normalizationGain(REFERENCE_LUFS)).toBe(1);
  });

  it("boosts quiet samples only a little", () => {
    expect(normalizationGain(-19)).toBeCloseTo(10 ** (1 / 20));
    expect(normalizationGain(-40)).toBeCloseTo(10 ** (3 / 20));
  });
});
