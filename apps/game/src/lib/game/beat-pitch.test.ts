import { describe, expect, it } from "vitest";

import { PitchTimeline } from "~/lib/audio/pitch-timeline";

import { beatPitch } from "./beat-pitch";

function timeline(frames: [time: number, hz: number][]) {
  const result = new PitchTimeline();
  for (const [time, hz] of frames) result.push(time, hz, 0.5);
  return result;
}

describe("beatPitch", () => {
  it("is the median of the voiced frames near the beat's end", () => {
    // A 150 ms beat ending at 1000: frames from 900 on count.
    const frames = timeline([
      [880, 100], // too early
      [900, 220],
      [910, 230],
      [920, -1], // unvoiced
      [930, 225],
      [1010, 500], // after the beat
    ]);
    expect(beatPitch(frames, 1000, 150)).toBe(225);
  });

  it("averages the middle two of an even count", () => {
    expect(
      beatPitch(
        timeline([
          [990, 200],
          [1000, 210],
        ]),
        1000,
        150,
      ),
    ).toBe(205);
  });

  it("looks back at least 20 ms on short beats", () => {
    expect(beatPitch(timeline([[981, 300]]), 1000, 15)).toBe(300);
    expect(beatPitch(timeline([[979, 300]]), 1000, 15)).toBe(-1);
  });

  it("is -1 without voiced frames or without a timeline", () => {
    expect(beatPitch(timeline([[990, -1]]), 1000, 150)).toBe(-1);
    expect(beatPitch(undefined, 1000, 150)).toBe(-1);
  });
});
