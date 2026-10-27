import { Key } from "@solid-primitives/keyed";
import { createMemo, For } from "solid-js";

import { useGame } from "~/lib/game/game-context";
import { noteRow, sungNoteRow } from "~/lib/game/note-rows";
import { type ProcessedBeat, usePlayer } from "~/lib/game/player-context";
import { addProcessedBeat, type ProcessedNoteGroup } from "~/lib/game/processed-notes";
import type { Note } from "~/lib/ultrastar/note";
import type { Phrase } from "~/lib/ultrastar/phrase";

import NoteBar from "./note-bar";
import SungFill from "./sung-fill";

export default function Pitch() {
  const game = useGame();
  const player = usePlayer();
  const isCompact = () => game.playerCount() > 2;
  const ROW_COUNT = isCompact() ? 12 : 16;

  const averageNote = createMemo(() => {
    const phrase = player.phrase();
    if (!phrase) {
      return 0;
    }

    const totalNotes = phrase.notes.reduce((sum, note) => sum + note.midiNote, 0);
    return Math.round(totalNotes / phrase.notes.length);
  });

  const columnCount = createMemo(() => {
    const notes = player.phrase()?.notes;
    if (!notes || notes.length === 0) {
      return 0;
    }

    if (notes.length === 1 && notes[0]) {
      return notes[0].length;
    }

    const firstNote = notes[0]!;
    const lastNote = notes.at(-1)!;

    return lastNote.startBeat + lastNote.length - firstNote.startBeat;
  });

  const getNoteRow = (midiNote: number) => noteRow(midiNote, averageNote(), ROW_COUNT);
  const getProcessedBeatRow = (beat: ProcessedBeat) =>
    sungNoteRow(beat.midiNote, beat.note.midiNote, averageNote(), ROW_COUNT);

  const notes = createMemo(() => {
    const phrase = player.phrase();

    if (!phrase) {
      return [];
    }

    const startBeat = phrase.notes[0]?.startBeat;
    if (startBeat === undefined) {
      return [];
    }

    return phrase.notes
      .filter((note) => note.type !== "Freestyle")
      .map((note) => {
        return {
          note,
          row: getNoteRow(note.midiNote),
          column: note.startBeat - startBeat + 1,
        };
      });
  });

  // Beats are only ever added in order, so the groups are built incrementally: finished groups
  // keep their objects (their ProcessedNote gets no new props) and only the last one changes.
  let grouped: { phrase: Phrase; groups: ProcessedNoteGroup[]; nextBeat: number } | undefined;

  const groupedProcessedBeats = createMemo(() => {
    const phrase = player.phrase();
    const firstNote = phrase?.notes[0];
    const lastNote = phrase?.notes.at(-1);
    if (!phrase || !firstNote || !lastNote) {
      grouped = undefined;
      return [];
    }

    const startBeat = firstNote.startBeat;
    const endBeat = lastNote.startBeat + lastNote.length;

    if (grouped?.phrase !== phrase) {
      grouped = { phrase, groups: [], nextBeat: startBeat };
    }

    // Reading only the beats not seen yet also subscribes only to those.
    let groups = grouped.groups;
    for (let i = grouped.nextBeat; i < endBeat; i++) {
      const beat = player.processedBeats.get(i);
      if (!beat) continue;

      if (groups === grouped.groups) {
        groups = groups.slice();
      }
      addProcessedBeat(groups, i, beat, startBeat, getProcessedBeatRow);
      grouped.nextBeat = i + 1;
    }

    grouped.groups = groups;
    return groups;
  });

  return (
    <div class="grid grow" classList={{ "px-48 py-[1cqh]": isCompact(), "px-48 py-[2cqh]": !isCompact() }}>
      <div
        style={{
          "grid-template-rows": `repeat(${ROW_COUNT},1fr)`,
          "grid-template-columns": `repeat(${columnCount()},1fr)`,
        }}
        class="col-start-1 row-start-1 grid h-full w-full"
      >
        <For each={notes()}>{(note) => <PitchNote note={note.note} row={note.row} column={note.column} />}</For>
      </div>
      <div
        style={{
          "grid-template-rows": `repeat(${ROW_COUNT},1fr)`,
          "grid-template-columns": `repeat(${columnCount()},1fr)`,
        }}
        class="col-start-1 row-start-1 grid h-full w-full"
      >
        <Key each={groupedProcessedBeats()} by={(item) => item.column}>
          {(groupedBeat) => (
            <ProcessedNote
              beat={groupedBeat().beat}
              note={groupedBeat().note}
              length={groupedBeat().length}
              row={groupedBeat().row}
              column={groupedBeat().column}
              delayedBeat={player.delayedBeat()}
              micColor={player.micColor(500)}
              rawMidiNotes={groupedBeat().rawMidiNotes}
              sungMidiNote={groupedBeat().midiNote}
            />
          )}
        </Key>
      </div>
    </div>
  );
}

interface PitchNoteProps {
  note: Note;
  row: number;
  column: number;
}

function PitchNote(props: PitchNoteProps) {
  return (
    <div
      class="relative"
      style={{
        "grid-row": props.row,
        "grid-column": `${props.column} / span ${props.note.length}`,
      }}
    >
      <div class="relative h-2/1 w-full -translate-y-1/4 transform">
        <NoteBar note={props.note} />
      </div>
    </div>
  );
}

interface ProcessedNoteProps {
  note: Note;
  beat: number;
  length: number;
  row: number;
  column: number;
  delayedBeat: number;
  micColor: string;
  rawMidiNotes: number[];
  sungMidiNote: number;
}

function ProcessedNote(props: ProcessedNoteProps) {
  return (
    <div
      class="relative min-w-0"
      style={{
        "grid-row": props.row,
        "grid-column": `${props.column} / span ${props.length}`,
      }}
    >
      <div class="absolute h-2/1 w-full -translate-y-1/4 transform">
        <SungFill
          note={props.note}
          length={props.length}
          delayedBeat={props.delayedBeat}
          micColor={props.micColor}
          rawMidiNotes={props.rawMidiNotes}
          sungMidiNote={props.sungMidiNote}
        />
      </div>
    </div>
  );
}
