import { Key } from "@solid-primitives/keyed";
import { createMemo, For, Show } from "solid-js";

import { effectsEnabled } from "~/lib/fx";
import { useGame } from "~/lib/game/game-context";
import { getGapTolerance } from "~/lib/game/pitch";
import { type ProcessedBeat, usePlayer } from "~/lib/game/player-context";
import { addProcessedBeat, type ProcessedNoteGroup } from "~/lib/game/processed-notes";
import { t } from "~/lib/i18n";
import { isGolden, isRap, type Note } from "~/lib/ultrastar/note";
import type { Phrase } from "~/lib/ultrastar/phrase";
import { clamp } from "~/lib/utils/math";
import { settingsStore } from "~/stores/settings";

/** Clip for a completely filled bar. */
const FULL_FILL = "none";

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
    const correctNoteRow = getNoteRow(beat.note.midiNote);
    const sungNoteRow = getNoteRow(beat.midiNote);

    const possibleRows = [sungNoteRow, sungNoteRow - 12, sungNoteRow + 12];

    let closestRow = sungNoteRow;
    let minDistance = Math.abs(correctNoteRow - sungNoteRow);

    for (const row of possibleRows) {
      if (row >= 0 && row < ROW_COUNT) {
        const distance = Math.abs(correctNoteRow - row);
        if (distance < minDistance) {
          minDistance = distance;
          closestRow = row;
        }
      }
    }

    return closestRow;
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

function SparkleParticles(props: { length: number }) {
  // Scale particles based on note length: base 4 particles + 2 per beat, capped at 16
  const particleCount = createMemo(() => Math.min(4 + Math.floor(props.length * 2), 16));

  // Generate random particles with different delays and positions
  // oxlint-disable-next-line solid/reactivity
  const particles = Array.from({ length: particleCount() }, (_, i) => ({
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
  const golden = () => isGolden(props.note);

  return (
    <div
      class="relative"
      style={{
        "grid-row": props.row,
        "grid-column": `${props.column} / span ${props.note.length}`,
      }}
    >
      <div class="relative h-2/1 w-full -translate-y-1/4 transform">
        {/* One outline, no shadow (a blurred one turns into a grey haze on light videos). */}
        <div
          class="relative h-full w-full overflow-hidden rounded-full border-[0.22cqw] transition-opacity duration-300"
          classList={{
            "border-yellow-300 bg-yellow-300/25": golden(),
            "border-white bg-black/35": !golden(),
            "border-dashed": isRap(props.note),
          }}
        >
          <Show when={golden() && effectsEnabled()}>
            <SparkleParticles length={props.note.length} />
          </Show>
        </div>
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
  // The initial delayed beat acts as the fixed start reference for this note fill animation.
  // oxlint-disable-next-line solid/reactivity
  const firstBeat = props.delayedBeat;

  // How much of the bar is filled, as a clip-path so it repaints without layout. The first beat
  // grows with a flat edge, then the rounded end follows. A full bar stops following the beat
  // until it grows by another beat.
  let fillLength = 0;
  const fillClip = createMemo((previous: string) => {
    const length = props.length;
    if (previous === FULL_FILL && length === fillLength) {
      return previous;
    }
    fillLength = length;

    const elapsed = props.delayedBeat - firstBeat;
    const filled = clamp((elapsed / length) * 100, 0, 100);

    if (elapsed <= 1) {
      // One beat's width, revealed by the share filled so far.
      const visible = filled / length;
      return visible >= 100 ? FULL_FILL : `inset(0 ${100 - visible}% 0 0)`;
    }

    return filled >= 100 ? FULL_FILL : `inset(0 ${100 - filled}% 0 0 round 9999px)`;
  }, "");

  const calculateAccuracyPosition = (rawMidi: number, targetMidi: number): number => {
    const tolerance = getGapTolerance(settingsStore.general().difficulty);

    let adjustedRawMidi = rawMidi;

    while (adjustedRawMidi > targetMidi + 6) {
      adjustedRawMidi -= 12;
    }
    while (adjustedRawMidi < targetMidi - 6) {
      adjustedRawMidi += 12;
    }

    const diff = adjustedRawMidi - targetMidi;

    const normalized = clamp(diff / tolerance, -1, 1);

    return 50 - normalized * 50;
  };

  const points = createMemo(() => {
    if (!isRap(props.note) && props.sungMidiNote !== props.note.midiNote) {
      return [];
    }

    const targetMidi = props.note.midiNote;

    return props.rawMidiNotes.map((rawMidi, i) => ({
      x: i + 0.5,
      y: calculateAccuracyPosition(rawMidi, targetMidi),
    }));
  });

  const accuracyLine = createMemo(() => {
    const currentPoints = points();
    if (currentPoints.length === 0) return null;

    const first = currentPoints[0];
    if (!first) return null;

    let d = `M 0 ${first.y} L ${first.x} ${first.y}`;

    for (let i = 1; i < currentPoints.length; i++) {
      const p0 = currentPoints[i - 1];
      const p1 = currentPoints[i];

      if (!p0 || !p1) continue;

      const midX = (p0.x + p1.x) / 2;
      const cp1x = midX;
      const cp1y = p0.y;
      const cp2x = midX;
      const cp2y = p1.y;

      d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
    }

    const last = currentPoints.at(-1);
    if (last) {
      d += ` L ${props.rawMidiNotes.length} ${last.y}`;
    }

    return d;
  });

  return (
    <div
      class="relative min-w-0"
      style={{
        "grid-row": props.row,
        "grid-column": `${props.column} / span ${props.length}`,
      }}
    >
      {/* Outline (0.22cqw) + a 0.2cqw gap before the sung fill. */}
      <div class="absolute h-2/1 w-full -translate-y-1/4 transform p-[0.42cqw]">
        <div class="relative h-full w-full">
          <div
            style={{
              "clip-path": fillClip(),
              "background-color": props.micColor,
            }}
            class="relative h-full w-full overflow-hidden rounded-full"
          >
            <Show when={accuracyLine()}>
              {(accuracyLine) => (
                <svg
                  class="absolute top-0 left-0 h-full w-full overflow-visible"
                  viewBox={`0 0 ${props.length} 100`}
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <title>{t("game.pitchAccuracy")}</title>
                  <path
                    d={accuracyLine()}
                    stroke="white"
                    stroke-width="2"
                    fill="none"
                    opacity="0.4"
                    vector-effect="non-scaling-stroke"
                  />
                </svg>
              )}
            </Show>
          </div>
        </div>
      </div>
    </div>
  );
}
