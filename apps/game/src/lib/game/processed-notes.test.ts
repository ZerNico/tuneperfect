import { describe, expect, it } from "vitest";

import type { Note } from "../ultrastar/note";
import type { ProcessedBeat } from "./player-context";
import { addProcessedBeat, type ProcessedNoteGroup } from "./processed-notes";

const makeNote = (startBeat: number, length: number, midiNote: number): Note => ({
  type: "Normal",
  startBeat,
  length,
  text: "",
  txtPitch: 0,
  midiNote,
});

const getRow = (beat: ProcessedBeat) => beat.midiNote % 12;

/** Deterministic pseudo-random numbers, so a failure is reproducible. */
function createRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 2 ** 32;
    return state / 2 ** 32;
  };
}

/** A phrase of notes and the beats a player hit, some silent, at a few different pitches. */
function makeSung(seed: number) {
  const random = createRandom(seed);
  const notes: Note[] = [];
  let beat = 10;
  for (let i = 0; i < 8; i++) {
    const length = 1 + Math.floor(random() * 5);
    notes.push(makeNote(beat, length, 60 + Math.floor(random() * 3)));
    beat += length + Math.floor(random() * 3);
  }

  const beats = new Map<number, ProcessedBeat>();
  for (const note of notes) {
    for (let i = 0; i < note.length; i++) {
      if (random() < 0.2) continue;
      beats.set(note.startBeat + i, {
        note,
        midiNote: random() < 0.7 ? note.midiNote : note.midiNote + 1,
        rawMidiNote: note.midiNote + random() - 0.5,
        isFirstInNote: i === 0,
      });
    }
  }

  return { beats, startBeat: notes[0]!.startBeat, endBeat: beat };
}

/** How the pitch display grouped a phrase's beats before it built the groups incrementally. */
function groupAllAtOnce(beats: Map<number, ProcessedBeat>, startBeat: number, endBeat: number) {
  const current: (ProcessedBeat & { beat: number })[] = [];
  for (let i = startBeat; i < endBeat; i++) {
    const beat = beats.get(i);
    if (beat) current.push({ beat: i, ...beat });
  }

  return current.reduce((grouped, beat) => {
    const lastGroup = grouped[grouped.length - 1];
    const shouldStartNewGroup =
      !lastGroup ||
      beat.isFirstInNote ||
      lastGroup.midiNote !== beat.midiNote ||
      lastGroup.beat + lastGroup.length !== beat.beat;

    if (shouldStartNewGroup) {
      grouped.push({
        ...beat,
        length: 1,
        row: getRow(beat),
        column: beat.beat - startBeat + 1,
        rawMidiNotes: [beat.rawMidiNote],
      });
    } else {
      lastGroup.length++;
      lastGroup.rawMidiNotes.push(beat.rawMidiNote);
    }

    return grouped;
  }, [] as ProcessedNoteGroup[]);
}

describe("addProcessedBeat", () => {
  it("groups beats of one note sung at the same pitch", () => {
    const note = makeNote(0, 4, 60);
    const groups: ProcessedNoteGroup[] = [];
    const beat = (midiNote: number, isFirstInNote = false) => ({
      note,
      midiNote,
      rawMidiNote: midiNote,
      isFirstInNote,
    });

    addProcessedBeat(groups, 0, beat(60, true), 0, getRow);
    addProcessedBeat(groups, 1, beat(60), 0, getRow);
    addProcessedBeat(groups, 2, beat(61), 0, getRow);
    // Beat 3 not sung, so beat 4 starts a new group.
    addProcessedBeat(groups, 4, beat(61), 0, getRow);

    expect(groups.map((group) => [group.beat, group.length, group.column])).toEqual([
      [0, 2, 1],
      [2, 1, 3],
      [4, 1, 5],
    ]);
  });

  it("builds the same groups beat by beat as grouping all beats at once, keeping finished groups", () => {
    for (let seed = 1; seed <= 50; seed++) {
      const { beats, startBeat, endBeat } = makeSung(seed);

      const all = groupAllAtOnce(beats, startBeat, endBeat);

      // As the game renders it: a fresh array per beat, earlier groups carried over.
      let incremental: ProcessedNoteGroup[] = [];
      for (let i = startBeat; i < endBeat; i++) {
        const beat = beats.get(i);
        if (!beat) continue;

        const previous = incremental;
        incremental = previous.slice();
        addProcessedBeat(incremental, i, beat, startBeat, getRow);

        for (let group = 0; group < previous.length - 1; group++) {
          expect(incremental[group]).toBe(previous[group]);
        }
      }

      expect(incremental).toEqual(all);
    }
  });
});
