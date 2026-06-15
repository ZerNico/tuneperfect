import { describe, expect, it } from "vitest";

import type { Note, Phrase, Voice } from "~/bindings";

import { getMedleySong } from "./medley";
import type { LocalSong } from "./song";

function makeNote(startBeat: number, length: number, text = "la"): Note {
  return { type: "Normal", startBeat, length, text, txtPitch: 0, midiNote: 0 };
}

function makePhrase(notes: Note[]): Phrase {
  return { disappearBeat: 0, notes };
}

function makeSong(partial: Partial<LocalSong> & { voices: Voice[] }): LocalSong {
  return {
    bpm: 120,
    gap: 0,
    medleyStartBeat: null,
    medleyEndBeat: null,
    ...partial,
  } as unknown as LocalSong;
}

describe("getMedleySong", () => {
  it("returns the original song unchanged when there are no notes", () => {
    const song = makeSong({ voices: [{ phrases: [] }] });
    expect(getMedleySong(song)).toBe(song);
  });

  it("returns the original song unchanged when there are no voices", () => {
    const song = makeSong({ voices: [] });
    expect(getMedleySong(song)).toBe(song);
  });

  it("uses an explicit medley window when it already exceeds the target duration", () => {
    // Window [8, 808] -> duration = 800 * 125 = 100000ms >= 30000ms target.
    const inRange = makePhrase([makeNote(100, 4)]);
    const outOfRange = makePhrase([makeNote(900, 4)]);
    const song = makeSong({
      medleyStartBeat: 8,
      medleyEndBeat: 808,
      voices: [{ phrases: [inRange, outOfRange] }],
    });

    const result = getMedleySong(song);

    // start = beatToMs(8) - 3000 = 1000 - 3000 = -2000
    // end   = beatToMs(808) + 3000 = 101000 + 3000 = 104000
    expect(result.start).toBe(-2000);
    expect(result.end).toBe(104000);

    // The out-of-range phrase is filtered out; only the in-range phrase remains.
    expect(result.voices[0]?.phrases).toEqual([inRange]);
    // Returns a new song object, not the original.
    expect(result).not.toBe(song);
  });

  it("falls back to a mid-song window when no explicit medley and no repeated sections", () => {
    // Distinct phrase texts -> findRepeatedSections finds nothing -> fallback.
    const phrases = [
      makePhrase([makeNote(0, 4, "alpha")]),
      makePhrase([makeNote(20, 4, "beta")]),
      makePhrase([makeNote(40, 4, "gamma")]),
      makePhrase([makeNote(100, 4, "delta")]),
    ];
    const song = makeSong({ voices: [{ phrases }] });

    const result = getMedleySong(song);

    // Fallback: lastNote startBeat=100 length=4 -> songEndBeat=104, middleBeat=52.
    // bpm*4 = 480, medleyMinBeats = 30000 * 480 / 60000 = 240, endBeat = 52 + 240 = 292.
    // start = beatToMs(52) - 3000 = 6500 - 3000 = 3500
    // end   = beatToMs(292) + 3000 = 36500 + 3000 = 39500
    expect(result.start).toBe(3500);
    expect(result.end).toBe(39500);
    expect(result).not.toBe(song);
  });
});
