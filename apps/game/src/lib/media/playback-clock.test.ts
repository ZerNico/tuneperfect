import { describe, expect, it } from "vitest";

import { PlaybackClock } from "./playback-clock";

function setup() {
  let now = 0;
  const clock = new PlaybackClock(() => now);
  const advance = (ms: number) => (now += ms);
  return { clock, advance };
}

describe("PlaybackClock", () => {
  it("doesn't run ahead while the video is still buffering", () => {
    const { clock, advance } = setup();
    clock.sample(0);
    advance(800);
    expect(clock.position()).toBe(0);
  });

  it("starts from where playback really began, without jumping back", () => {
    const { clock, advance } = setup();
    clock.sample(0);
    advance(800); // asked to play, still buffering
    const before = clock.position();

    clock.sample(0.05); // YouTube reports playing
    clock.setRunning(true);
    expect(clock.position()).toBeGreaterThanOrEqual(before);

    advance(500);
    expect(clock.position()).toBeCloseTo(0.55);
  });

  it("interpolates between samples", () => {
    const { clock, advance } = setup();
    clock.setRunning(true);
    clock.sample(10);
    advance(250);
    expect(clock.position()).toBeCloseTo(10.25);
  });

  it("holds through a slightly late sample instead of stepping back", () => {
    const { clock, advance } = setup();
    clock.setRunning(true);
    clock.sample(1);
    advance(200);
    expect(clock.position()).toBeCloseTo(1.2);

    clock.sample(1.1); // lags the interpolation a little
    expect(clock.position()).toBeCloseTo(1.2);
    advance(200);
    expect(clock.position()).toBeCloseTo(1.3);
  });

  it("follows large corrections and seeks backwards", () => {
    const { clock, advance } = setup();
    clock.setRunning(true);
    clock.sample(5);
    advance(500);
    clock.position();

    clock.sample(3);
    expect(clock.position()).toBe(3);

    clock.seek(1);
    expect(clock.position()).toBe(1);
  });

  it("freezes where it got to when stopped", () => {
    const { clock, advance } = setup();
    clock.setRunning(true);
    clock.sample(2);
    advance(400);
    clock.setRunning(false);
    advance(1000);
    expect(clock.position()).toBeCloseTo(2.4);
  });

  it("stops extrapolating when samples stop coming", () => {
    const { clock, advance } = setup();
    clock.setRunning(true);
    clock.sample(0);
    advance(5000);
    expect(clock.position()).toBe(1);
  });
});
