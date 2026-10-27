import { describe, expect, it } from "vitest";

import type { Note } from "~/lib/ultrastar/note";
import type { Song } from "~/lib/ultrastar/song";
import type { Voice } from "~/lib/ultrastar/voice";

import { buildLaneTimeline, visibleRange } from "./timeline";

// 60 BPM in UltraStar's quarter beats: 250 ms a beat, after a 1 s gap.
const song = { bpm: 60, gap: 1000 } as Song;

const note = (startBeat: number, length: number, midiNote: number, type: Note["type"] = "Normal"): Note => ({
  type,
  startBeat,
  length,
  text: "la",
  txtPitch: midiNote - 60,
  midiNote,
});

const voice = (...phrases: Note[][]): Voice => ({
  phrases: phrases.map((notes) => ({ disappearBeat: 0, notes })),
});

describe("buildLaneTimeline", () => {
  it("times notes like the game clock, gap included", () => {
    const { notes } = buildLaneTimeline(song, voice([note(0, 2, 60), note(4, 1, 62)]), { rows: 16, margin: 2 });
    expect(notes.map((n) => [n.startMs, n.endMs])).toEqual([
      [1000, 1500],
      [2000, 2250],
    ]);
  });

  it("skips phrases without notes", () => {
    const { notes, camera } = buildLaneTimeline(song, voice([], [note(0, 2, 60)], [], [note(8, 2, 62)]), {
      rows: 16,
      margin: 2,
    });
    expect(notes.map((n) => n.phrase)).toEqual([0, 1]);
    expect(camera.centres.every(Number.isFinite)).toBe(true);
  });

  it("draws a phrase an octave up or down when that's nearer the camera", () => {
    const { notes } = buildLaneTimeline(
      song,
      voice([note(0, 2, 60), note(2, 2, 62)], [note(10, 2, 72), note(12, 2, 74)]),
      {
        rows: 16,
        margin: 2,
      },
    );
    expect(notes.map((n) => n.displayMidi)).toEqual([60, 62, 60, 62]);
  });

  it("folds the outliers of a phrase too wide for the lane", () => {
    const { notes } = buildLaneTimeline(song, voice([note(0, 1, 48), note(1, 1, 60), note(2, 1, 76)]), {
      rows: 12,
      margin: 1,
    });
    for (const n of notes) {
      expect(n.displayMidi % 12).toBe(n.note.midiNote % 12);
    }
    const shown = notes.map((n) => n.displayMidi);
    expect(Math.max(...shown) - Math.min(...shown)).toBeLessThan(12);
  });

  it("keeps freestyle notes, but places the camera by the sung ones", () => {
    const { notes, camera } = buildLaneTimeline(
      song,
      voice([note(0, 1, 30, "Freestyle"), note(1, 2, 64), note(3, 2, 66)]),
      {
        rows: 16,
        margin: 2,
      },
    );
    expect(notes[0]?.freestyle).toBe(true);
    expect(camera.centres).toEqual([65]);
  });
});

describe("visibleRange", () => {
  const { notes } = buildLaneTimeline(song, voice([note(0, 2, 60), note(4, 2, 60), note(8, 2, 60)]), {
    rows: 16,
    margin: 2,
  });
  // Notes at 1000–1500, 2000–2500, 3000–3500.

  it("includes notes overlapping the window", () => {
    expect(visibleRange(notes, 1400, 2100)).toEqual([0, 2]);
    expect(visibleRange(notes, 1600, 1900)).toEqual([1, 1]);
    expect(visibleRange(notes, 0, 10_000)).toEqual([0, 3]);
    expect(visibleRange(notes, 4000, 5000)).toEqual([3, 3]);
  });
});
