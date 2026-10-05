import { describe, expect, it } from "vitest";

import { createComboTracker, isComboMilestone } from "./combo";

describe("createComboTracker", () => {
  it("counts a note as hit when more than half of its beats are correct", () => {
    const tracker = createComboTracker();

    expect(tracker.noteFinished(3, 4)?.hit).toBe(true);
    expect(tracker.noteFinished(2, 4)?.hit).toBe(false);
    expect(tracker.noteFinished(1, 2)?.hit).toBe(false);
  });

  it("increments the combo per hit note and tracks the maximum", () => {
    const tracker = createComboTracker();

    tracker.noteFinished(1, 1);
    tracker.noteFinished(1, 1);
    const outcome = tracker.noteFinished(3, 3);

    expect(outcome?.combo).toBe(3);
    expect(tracker.maxCombo()).toBe(3);
  });

  it("reports the broken combo and resets on a miss", () => {
    const tracker = createComboTracker();

    tracker.noteFinished(1, 1);
    tracker.noteFinished(1, 1);
    const outcome = tracker.noteFinished(0, 2);

    expect(outcome).toEqual({ hit: false, combo: 0, milestone: false, brokenCombo: 2 });
    expect(tracker.combo()).toBe(0);
    expect(tracker.maxCombo()).toBe(2);
  });

  it("ignores notes without scored beats", () => {
    const tracker = createComboTracker();

    tracker.noteFinished(1, 1);

    expect(tracker.noteFinished(0, 0)).toBeNull();
    expect(tracker.combo()).toBe(1);
  });

  it("flags milestones", () => {
    const tracker = createComboTracker();
    const milestones: number[] = [];

    for (let i = 0; i < 200; i++) {
      const outcome = tracker.noteFinished(1, 1);
      if (outcome?.milestone) {
        milestones.push(outcome.combo);
      }
    }

    expect(milestones).toEqual([10, 25, 50, 100, 200]);
  });
});

describe("isComboMilestone", () => {
  it("does not flag regular combos", () => {
    expect(isComboMilestone(0)).toBe(false);
    expect(isComboMilestone(11)).toBe(false);
    expect(isComboMilestone(150)).toBe(false);
  });
});
