import { describe, expect, it } from "vitest";

import { PitchTimeline } from "./pitch-timeline";

const range = (timeline: PitchTimeline, from: number, to: number) => {
  const times: number[] = [];
  timeline.forEachInRange(from, to, (time) => times.push(time));
  return times;
};

describe("PitchTimeline", () => {
  it("returns the samples in a range, in order", () => {
    const timeline = new PitchTimeline(16);
    for (let time = 0; time < 100; time += 10) timeline.push(time, 440, 0.5);

    expect(range(timeline, 25, 60)).toEqual([30, 40, 50, 60]);
    expect(range(timeline, -100, 5)).toEqual([0]);
    expect(range(timeline, 95, 200)).toEqual([]);
    expect(timeline.latest()).toEqual({ time: 90, hz: 440, level: 0.5 });
  });

  it("keeps the newest samples once full", () => {
    const timeline = new PitchTimeline(4);
    for (let time = 0; time < 10; time++) timeline.push(time, time, 0);

    expect(timeline.size).toBe(4);
    expect(range(timeline, 0, 100)).toEqual([6, 7, 8, 9]);
    expect(timeline.latest()?.hz).toBe(9);
  });

  it("drops samples that would go back in time", () => {
    const timeline = new PitchTimeline(8);
    timeline.push(10, 1, 0);
    timeline.push(5, 2, 0);
    timeline.push(10, 3, 0);

    expect(range(timeline, 0, 100)).toEqual([10, 10]);
  });

  it("starts over when cleared", () => {
    const timeline = new PitchTimeline(8);
    timeline.push(10, 1, 0);
    timeline.clear();
    timeline.push(5, 2, 0);

    expect(timeline.latest()?.time).toBe(5);
    expect(timeline.size).toBe(1);
  });
});
