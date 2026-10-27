import { beatToMs } from "~/lib/ultrastar/bpm";
import type { Song } from "~/lib/ultrastar/song";
import type { Voice } from "~/lib/ultrastar/voice";

/**
 * A fake singer for development, so a round can be watched without a microphone (the dev
 * playground turns it on). Each mic sings its voice's notes with some wobble, occasional misses
 * of a few semitones, and every other mic an octave down, to exercise octave folding. Short gaps
 * between notes are slid through, like real singers carry on between them.
 */
export interface SimulatedSinger {
  /** Hz the mic hears at `songMs`, or -1 for silence. */
  hzAt(mic: number, songMs: number): number;
}

/**
 * Set by the dev playground only, in memory: the game shares the playground's origin and storage,
 * so a stored switch would leak into real rounds.
 */
let simulatedAccuracy: number | undefined;

/** Turns the simulated singer on with an accuracy (0–1), or off. Development builds only. */
export function setSimulatedSinger(accuracy: number | undefined) {
  simulatedAccuracy =
    import.meta.env.DEV && accuracy !== undefined && Number.isFinite(accuracy)
      ? Math.max(0, Math.min(1, accuracy))
      : undefined;
}

/** The accuracy (0–1) to simulate with, if the simulated singer is on. */
export function simulatedSingerAccuracy(): number | undefined {
  return simulatedAccuracy;
}

/** Gaps up to this long are sung through. */
const GAP_SLIDE_MS = 600;

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

  /** The note at `ms`, or the gap it falls in (between `before` and `after`). */
  const noteAt = (mic: number, ms: number) => {
    const notes = timed[mic] ?? [];
    let low = 0;
    let high = notes.length;
    while (low < high) {
      const mid = (low + high) >> 1;
      if (notes[mid]!.endMs <= ms) low = mid + 1;
      else high = mid;
    }
    const candidate = notes[low];
    if (candidate && candidate.startMs <= ms) return { note: candidate.note };
    return { before: notes[low - 1], after: candidate };
  };
  const toHz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);

  return {
    hzAt(mic, songMs) {
      const octave = mic % 2 === 1 ? -12 : 0;
      const { note, before, after } = noteAt(mic, songMs);
      if (!note) {
        if (!before || !after || after.startMs - before.endMs > GAP_SLIDE_MS) return -1;
        const share = (songMs - before.endMs) / (after.startMs - before.endMs);
        return toHz(before.note.midiNote + (after.note.midiNote - before.note.midiNote) * share + octave);
      }
      if (note.type === "Freestyle") return -1;

      const seed = mic * 977 + note.startBeat * 31;
      const wobble = Math.sin((songMs + seed) / 85) * 0.3 + Math.sin((songMs + seed) / 23) * 0.12;
      // Some notes are missed by a few semitones, how many depends on the accuracy.
      const missing = (Math.sin(seed) + 1) / 2 > accuracy;
      const miss = missing ? (Math.sin(seed * 3) > 0 ? 3.5 : -3.5) : 0;
      return toHz(note.midiNote + octave + miss + wobble);
    },
  };
}
