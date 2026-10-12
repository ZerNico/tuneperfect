import { beatToMs } from "~/lib/ultrastar/bpm";
import type { Note } from "~/lib/ultrastar/note";
import type { Song } from "~/lib/ultrastar/song";
import type { Voice } from "~/lib/ultrastar/voice";

/**
 * A fake singer for development, so a round can be watched without a microphone (the dev
 * playground turns it on). Each mic sings its voice's notes with some wobble, occasional misses
 * of a few semitones, and every other mic an octave down, to exercise octave folding.
 */
export interface SimulatedSinger {
  /** Hz the mic hears at `songMs`, or -1 for silence. */
  hzAt(mic: number, songMs: number): number;
}

const STORAGE_KEY = "tp.simulatedSinger";

/** The accuracy (0–1) to simulate with, if the simulated singer is on. Development builds only. */
export function simulatedSingerAccuracy(): number | undefined {
  if (!import.meta.env.DEV) return undefined;
  const value = globalThis.localStorage?.getItem(STORAGE_KEY);
  if (!value) return undefined;
  const accuracy = Number(value);
  return Number.isFinite(accuracy) ? Math.max(0, Math.min(1, accuracy)) : undefined;
}

export function createSimulatedSinger(song: Song, voices: (Voice | undefined)[], accuracy: number): SimulatedSinger {
  const timed = voices.map((voice) =>
    (voice?.phrases ?? []).flatMap((phrase) =>
      phrase.notes.map((note) => ({
        note,
        startMs: beatToMs(song, note.startBeat),
        endMs: beatToMs(song, note.startBeat + note.length),
      })),
    ),
  );

  const noteAt = (mic: number, ms: number): Note | undefined => {
    const notes = timed[mic] ?? [];
    let low = 0;
    let high = notes.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (notes[mid]!.endMs <= ms) low = mid + 1;
      else high = mid;
    }
    const candidate = notes[low];
    return candidate && candidate.startMs <= ms ? candidate.note : undefined;
  };

  return {
    hzAt(mic, songMs) {
      const note = noteAt(mic, songMs);
      if (!note || note.type === "Freestyle") return -1;

      const seed = mic * 977 + note.startBeat * 31;
      const wobble = Math.sin((songMs + seed) / 85) * 0.3 + Math.sin((songMs + seed) / 23) * 0.12;
      // Some notes are missed by a few semitones, how many depends on the accuracy.
      const missing = (Math.sin(seed) + 1) / 2 > accuracy;
      const miss = missing ? (Math.sin(seed * 3) > 0 ? 3.5 : -3.5) : 0;
      const octave = mic % 2 === 1 ? -12 : 0;

      const midi = note.midiNote + octave + miss + wobble;
      return 440 * 2 ** ((midi - 69) / 12);
    },
  };
}
