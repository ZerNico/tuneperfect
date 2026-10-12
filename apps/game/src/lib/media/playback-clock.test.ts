import { describe, expect, it } from "vitest";

import { PlaybackClock, STEPPED_SOURCE } from "./playback-clock";

function setup() {
  let now = 0;
  const clock = new PlaybackClock(() => now);
  const advance = (ms: number) => (now += ms);
  /** Positions every 8 ms (a 120 Hz display) for the next `ms`. */
  const frames = (ms: number) => {
    const positions: number[] = [];
    for (let t = 0; t < ms; t += 8) {
      advance(8);
      positions.push(clock.position());
    }
    return positions;
  };
  return { clock, advance, frames };
}

const steps = (positions: number[]) => positions.slice(1).map((position, i) => position - positions[i]!);

describe("PlaybackClock", () => {
  it("doesn't run ahead while the video is still buffering", () => {
    const { clock, advance } = setup();
    clock.sample(0);
    advance(800);
    expect(clock.position()).toBe(0);
  });

  it("starts from where playback really began", () => {
    const { clock, advance } = setup();
    clock.sample(0);
    advance(800); // asked to play, still buffering

    clock.sample(0.05); // YouTube reports playing
    clock.setRunning(true);
    expect(clock.position()).toBeCloseTo(0.05);

    advance(500);
    expect(clock.position()).toBeCloseTo(0.55);
  });

  it("runs at real time between samples", () => {
    const { clock, advance } = setup();
    clock.setRunning(true);
    clock.sample(10);
    advance(250);
    expect(clock.position()).toBeCloseTo(10.25);
  });

  it("never stalls or steps back on uneven samples, and drifts back in line", () => {
    const { clock, frames } = setup();
    clock.setRunning(true);
    clock.sample(0);
    let positions = [clock.position(), ...frames(250)];

    // Late and early samples, like YouTube's first ones.
    clock.sample(0.1);
    positions = positions.concat(frames(250));
    clock.sample(0.45);
    positions = positions.concat(frames(250));
    // Then on time, every 250 ms like the embed.
    for (let source = 0.75; source <= 2.25; source += 0.25) {
      clock.sample(source);
      positions = positions.concat(frames(250));
    }

    expect(Math.min(...steps(positions))).toBeGreaterThan(0);
    // Back in line with the source, which is at 2.5 by now.
    expect(clock.position()).toBeCloseTo(2.5, 1);
  });

  it("jumps for large differences and seeks", () => {
    const { clock, advance } = setup();
    clock.setRunning(true);
    clock.sample(5);
    advance(500);

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

describe("PlaybackClock with the stepped-source tuning", () => {
  it("smooths an audio element's stalls and jumps into an even clock", () => {
    let now = 0;
    const clock = new PlaybackClock(() => now, STEPPED_SOURCE);
    clock.setRunning(true);

    // The element's time stalls for a frame every few frames, then catches up.
    let source = 0;
    const positions: number[] = [];
    for (let frame = 0; frame < 600; frame++) {
      now += 8;
      source += frame % 5 === 4 ? 0 : 10;
      clock.sample(source / 1000);
      positions.push(clock.position());
    }

    const steps = positions.slice(100).map((p, i) => p - positions[99 + i]!);
    // Every frame advances, by close to the real 8 ms, and the clock stays within a few ms of the source.
    for (const step of steps) expect(step * 1000).toBeGreaterThan(6);
    for (const step of steps) expect(step * 1000).toBeLessThan(10);
    expect(Math.abs(positions.at(-1)! * 1000 - source)).toBeLessThan(15);
  });
});
