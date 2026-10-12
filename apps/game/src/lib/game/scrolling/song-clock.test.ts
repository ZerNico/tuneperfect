import { describe, expect, it } from "vitest";

import { SongClock } from "./song-clock";

describe("SongClock", () => {
  it("maps nothing before playback starts", () => {
    const clock = new SongClock();
    clock.frame(1000, 0, false);
    expect(clock.songAt(1000)).toBeUndefined();
  });

  it("maps times while playing, including slightly before the latest frame", () => {
    const clock = new SongClock();
    clock.frame(1000, 0, true);
    clock.frame(1016, 16, true);
    clock.frame(1032, 32, true);
    expect(clock.songAt(1020)).toBe(20);
    expect(clock.songAt(1040)).toBe(40);
  });

  it("starts a new epoch on a seek and forgets times from before it", () => {
    const clock = new SongClock();
    clock.frame(1000, 0, true);
    clock.frame(1016, 16, true);
    const epoch = clock.epoch;

    clock.frame(1032, 10_000, true);
    expect(clock.epoch).toBe(epoch + 1);
    expect(clock.songAt(1020)).toBeUndefined();
    expect(clock.songAt(1040)).toBe(10_008);
  });

  it("ignores frame jitter", () => {
    const clock = new SongClock();
    clock.frame(1000, 0, true);
    const epoch = clock.epoch;
    clock.frame(1016, 30, true);
    clock.frame(1032, 28, true);
    expect(clock.epoch).toBe(epoch);
  });

  it("starts a new epoch after a pause", () => {
    const clock = new SongClock();
    clock.frame(1000, 0, true);
    clock.frame(1016, 16, false);
    expect(clock.songAt(1016)).toBeUndefined();

    const epoch = clock.epoch;
    clock.frame(5000, 16, true);
    expect(clock.epoch).toBe(epoch + 1);
    expect(clock.songAt(4000)).toBeUndefined();
    expect(clock.songAt(5010)).toBe(26);
  });
});
