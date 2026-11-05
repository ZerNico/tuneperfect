import { describe, expect, it } from "vitest";

import { nearestSurvivorIndex } from "./array";

const id = (item: string) => item;

describe("nearestSurvivorIndex", () => {
  it("picks the nearest item that is still there, the next one on a tie", () => {
    expect(nearestSurvivorIndex(["a", "b", "c", "d"], ["x", "a", "d"], "b", id)).toBe(1);
    expect(nearestSurvivorIndex(["a", "b", "c"], ["a", "c"], "b", id)).toBe(1);
    expect(nearestSurvivorIndex(["a", "b", "c", "d", "e"], ["a", "e"], "c", id)).toBe(1);
  });

  it("falls back to the previous one at the end", () => {
    expect(nearestSurvivorIndex(["a", "b", "c"], ["x", "a"], "c", id)).toBe(1);
  });

  it("is 0 when nothing is left or the id is unknown", () => {
    expect(nearestSurvivorIndex(["a", "b"], ["x"], "b", id)).toBe(0);
    expect(nearestSurvivorIndex(["a", "b"], ["a"], "z", id)).toBe(0);
  });

  it("follows a neighbour whose position moved", () => {
    expect(nearestSurvivorIndex(["a", "b", "c"], ["new", "a", "c"], "b", id)).toBe(2);
  });
});
