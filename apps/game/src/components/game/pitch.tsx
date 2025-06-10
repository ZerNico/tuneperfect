import { Key } from "@solid-primitives/keyed";
import { createMemo, createSignal, For } from "solid-js";
import { usePlayer } from "~/lib/game/player-context";
import type { Note } from "~/lib/ultrastar/note";
import { clamp } from "~/lib/utils/math";

const ROW_COUNT = 16;

export default function Pitch() {
  const player = usePlayer();

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

    // biome-ignore lint/style/noNonNullAssertion: Checked above
    const firstNote = notes[0]!;
    // biome-ignore lint/style/noNonNullAssertion: Checked above
    const lastNote = notes.at(-1)!;

    return lastNote.startBeat + lastNote.length - firstNote.startBeat;
  });

  const getNoteRow = (note: number) => {
    let wrappedMidiNote: number = note;

    const minNoteRowMidiNote = Math.floor(averageNote() - ROW_COUNT / 2);
    const maxNoteRowMidiNote = minNoteRowMidiNote + ROW_COUNT - 1;

    // move by octave to fit on screen
    while (wrappedMidiNote > maxNoteRowMidiNote && wrappedMidiNote > 0) wrappedMidiNote -= 12;
    while (wrappedMidiNote < minNoteRowMidiNote && wrappedMidiNote < 127) wrappedMidiNote += 12;

    const offset: number = wrappedMidiNote - averageNote();
    let noteRow = Math.ceil(ROW_COUNT / 2 + offset);
    noteRow = Math.abs(noteRow - ROW_COUNT) - 1;

    return noteRow;
  };

  const getProcessedBeatRow = (beat: ProcessedBeat) => {
    if (beat.midiNote === beat.note.midiNote) {
      return getNoteRow(beat.midiNote);
    }

    const noteRow = getNoteRow(beat.midiNote);
    const alternativeNoteRow = noteRow - 12;

    if (alternativeNoteRow >= 0 && alternativeNoteRow < ROW_COUNT) {
      const correctNoteRow = getNoteRow(beat.note.midiNote);

      if (Math.abs(correctNoteRow - noteRow) < Math.abs(correctNoteRow - alternativeNoteRow)) {
        return noteRow;
      }
      return alternativeNoteRow;
    }

    return getNoteRow(beat.midiNote);
  };

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

  const currentProcessedBeats = createMemo(() => {
    const phrase = player.phrase();
    if (!phrase) {
      return [];
    }
    const firstNote = phrase.notes[0];
    const lastNote = phrase.notes.at(-1);
    if (!firstNote || !lastNote) {
      return [];
    }

    const startBeat = firstNote.startBeat;
    const endBeat = lastNote.startBeat + lastNote.length;

    const currentProcessedBeats: ProcessedBeat[] = [];

    for (let i = startBeat; i < endBeat; i++) {
      const beat = player.processedBeats.get(i);
      if (beat) {
        currentProcessedBeats.push({ beat: i, note: beat.note, midiNote: beat.midiNote });
      }
    }

    return currentProcessedBeats;
  });

  const groupedProcessedBeats = createMemo(() => {
    const current = currentProcessedBeats();

    const phrase = player.phrase();
    if (!phrase) {
      return [];
    }

    const firstNote = phrase.notes[0];
    if (!firstNote) {
      return [];
    }
    const startBeat = firstNote.startBeat;

    const grouped: DisplayedProcessedBeat[] = [];
    let currentGroup: DisplayedProcessedBeat | undefined;

    for (const beat of current) {
      if (!currentGroup) {
        currentGroup = {
          ...beat,
          length: 1,
          row: getNoteRow(beat.midiNote),
          column: beat.beat - startBeat + 1,
        };
        continue;
      }
      if (currentGroup.midiNote !== beat.midiNote || currentGroup.beat + currentGroup.length !== beat.beat) {
        grouped.push(currentGroup);
        currentGroup = {
          ...beat,
          length: 1,
          row: getProcessedBeatRow(beat),
          column: beat.beat - startBeat + 1,
        };
        continue;
      }
      currentGroup.length++;
    }

    if (currentGroup) {
      grouped.push(currentGroup);
    }

    return grouped;
  });

  const micColor = () => `var(--color-${player.microphone().color}-500)`;

  return (
    <div
      class="grid flex-grow px-48"
      classList={{
        "pt-[2cqh] pb-[8cqh]": player.index() === 0,
        "pt-[8cqh] pb-[2cqh]": player.index() === 1,
      }}
    >
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
            <ProcessedBeat
              beat={groupedBeat().beat}
              note={groupedBeat().note}
              length={groupedBeat().length}
              row={groupedBeat().row}
              column={groupedBeat().column}
              delayedBeat={player.delayedBeat()}
              micColor={micColor()}
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

function SparkleParticles(props: { length: number }) {
  // Scale particles based on note length: base 4 particles + 2 per beat, capped at 16
  const particleCount = Math.min(4 + Math.floor(props.length * 2), 16);

  // Generate random particles with different delays and positions
  const particles = Array.from({ length: particleCount }, (_, i) => ({
    id: i,
    delay: Math.random() * 2,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 0.3 + 0.2, // 0.2 to 0.5
    duration: Math.random() * 1.5 + 1.5, // 1.5 to 3 seconds
  }));

  return (
    <div class="pointer-events-none absolute inset-0 overflow-hidden">
      <For each={particles}>
        {(particle) => (
          <div
            class="absolute animate-sparkle rounded-full bg-yellow-300 opacity-0"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
              width: `${particle.size}cqw`,
              height: `${particle.size}cqw`,
              "animation-delay": `${particle.delay}s`,
              "animation-duration": `${particle.duration}s`,
              "box-shadow": "0 0 0.2cqw rgba(251, 191, 36, 0.8)",
            }}
          />
        )}
      </For>
    </div>
  );
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
      <div
        class="-translate-y-1/4 relative h-2/1 w-full transform overflow-hidden rounded-full border-[0.15cqw] shadow-md"
        classList={{
          "border-yellow-400 bg-yellow-400/20": props.note.type === "Golden",
          "border-white bg-black/20": props.note.type !== "Golden",
        }}
      >
        {props.note.type === "Golden" && <SparkleParticles length={props.note.length} />}
      </div>
    </div>
  );
}

interface ProcessedBeatProps {
  note: Note;
  beat: number;
  length: number;
  row: number;
  column: number;
  delayedBeat: number;
  micColor: string;
}

function ProcessedBeat(props: ProcessedBeatProps) {
  const [firstBeat] = createSignal(props.delayedBeat);

  const fill = createMemo(() => {
    const delayedBeat = props.delayedBeat;

    const fillPercentage = clamp(((delayedBeat - firstBeat()) / props.length) * 100, 0, 100);

    if (delayedBeat - firstBeat() <= 1) {
      return {
        "clip-percentage": fillPercentage,
        "width-percentage": 100 / props.length,
      };
    }

    return {
      "clip-percentage": 100,
      "width-percentage": fillPercentage,
    };
  });

  return (
    <div
      class="relative min-w-0"
      style={{
        "grid-row": props.row,
        "grid-column": `${props.column} / span ${props.length}`,
      }}
    >
      <div class="-translate-y-1/4 absolute h-2/1 w-full transform p-[0.35cqw]">
        <div
          style={{
            "clip-path": `polygon(0% 0%, ${fill()["clip-percentage"]}% 0%, ${fill()["clip-percentage"]}% 100%, 0% 100%)`,
            width: `${fill()["width-percentage"]}%`,
            "background-color": props.micColor,
          }}
          class="h-full w-full rounded-full"
        />
      </div>
    </div>
  );
}

interface ProcessedBeat {
  beat: number;
  note: Note;
  midiNote: number;
}

interface DisplayedProcessedBeat extends ProcessedBeat {
  length: number;
  row: number;
  column: number;
}
