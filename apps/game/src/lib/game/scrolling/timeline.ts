import { beatToMs } from "~/lib/ultrastar/bpm";
import type { Note } from "~/lib/ultrastar/note";
import type { Song } from "~/lib/ultrastar/song";
import type { Voice } from "~/lib/ultrastar/voice";

import { type CameraPlan, planCamera, visiblePitches } from "./camera";

/** A note placed on the scrolling lane. */
export interface LaneNote {
  note: Note;
  /** Index of the phrase it belongs to, among the phrases with notes. */
  phrase: number;
  startMs: number;
  endMs: number;
  /** The pitch it's drawn at: its own, moved by octaves to sit near the camera. */
  displayMidi: number;
  /** Freestyle notes aren't drawn as bars, only their syllables. */
  freestyle: boolean;
}

export interface LaneTimeline {
  /** In time order. Notes of one voice don't overlap, so their ends are in order too. */
  notes: LaneNote[];
  camera: CameraPlan;
}

/**
 * Everything the scrolling lane needs to place a voice's notes: when each is sung (song time in
 * ms, the same as `game.ms()`) and at which pitch it's drawn. Medleys need nothing special: the
 * phrases outside the medley just never come into view.
 */
export function buildLaneTimeline(song: Song, voice: Voice, options: { rows: number; margin: number }): LaneTimeline {
  // A line break with no notes before it makes an empty phrase, which has no place or pitch.
  const phrases = voice.phrases.filter((phrase) => phrase.notes.length > 0);
  const placed = phrases.map((phrase) =>
    phrase.notes.map((note) => ({
      note,
      startMs: beatToMs(song, note.startBeat),
      endMs: beatToMs(song, note.startBeat + note.length),
      freestyle: note.type === "Freestyle",
    })),
  );

  const spans = placed.map((notes) => {
    // The camera follows the drawn notes; a phrase of only freestyle notes, all of them.
    const drawn = notes.some((n) => !n.freestyle) ? notes.filter((n) => !n.freestyle) : notes;
    const pitches = drawn.map((n) => n.note.midiNote);
    return {
      startMs: notes[0]!.startMs,
      endMs: notes.at(-1)!.endMs,
      low: Math.min(...pitches),
      high: Math.max(...pitches),
    };
  });
  const camera = planCamera(spans, options.rows, options.margin);

  const notes: LaneNote[] = [];
  for (const [phrase, phraseNotes] of placed.entries()) {
    const shift = camera.shifts[phrase] ?? 0;
    const { lowest, highest } = visiblePitches(camera.centres[phrase] ?? 0, options.rows);
    for (const placedNote of phraseNotes) {
      // Notes of a phrase too wide for the lane fold in by octaves, like the classic lane.
      let displayMidi = placedNote.note.midiNote + shift;
      while (displayMidi > highest) displayMidi -= 12;
      while (displayMidi < lowest) displayMidi += 12;
      notes.push({ ...placedNote, phrase, displayMidi });
    }
  }

  return { notes, camera };
}

/** The `[start, end)` indices of the notes that overlap `fromMs`–`toMs`. */
export function visibleRange(notes: LaneNote[], fromMs: number, toMs: number): [number, number] {
  return [firstIndex(notes, (n) => n.endMs >= fromMs), firstIndex(notes, (n) => n.startMs > toMs)];
}

/** The first index where `matches` turns true; it must be false, then true, along the notes. */
function firstIndex(notes: LaneNote[], matches: (note: LaneNote) => boolean): number {
  let low = 0;
  let high = notes.length;
  while (low < high) {
    const mid = (low + high) >> 1;
    if (matches(notes[mid]!)) high = mid;
    else low = mid + 1;
  }
  return low;
}
