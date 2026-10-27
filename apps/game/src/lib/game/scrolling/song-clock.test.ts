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

  it("keeps mapping times from before a pause, and carries on after it", () => {
    const clock = new SongClock();
    clock.frame(1000, 0, true);
    clock.frame(1016, 16, false);
    // Frames sung just before the pause arrive after it.
    expect(clock.songAt(1010)).toBe(10);
    expect(clock.songAt(2000)).toBeUndefined();

    const epoch = clock.epoch;
    clock.frame(5000, 16, true);
    expect(clock.epoch).toBe(epoch);
    expect(clock.songAt(4000)).toBeUndefined();
    expect(clock.songAt(5010)).toBe(26);
  });

  it("starts a new epoch when the song was moved during a pause", () => {
    const clock = new SongClock();
    clock.frame(1000, 0, true);
    clock.frame(1016, 16, false);
    const epoch = clock.epoch;
    clock.frame(5000, 30_000, true);
    expect(clock.epoch).toBe(epoch + 1);
  });

  it("keeps running through a song time that stopped moving, like at the song's end", () => {
    const clock = new SongClock();
    clock.frame(1000, 0, true);
    clock.frame(1016, 16, true);
    const epoch = clock.epoch;
    for (let perf = 1032; perf <= 2000; perf += 16) clock.frame(perf, 16, true);
    expect(clock.epoch).toBe(epoch);
    expect(clock.songAt(1500)).toBe(500);
  });
});
