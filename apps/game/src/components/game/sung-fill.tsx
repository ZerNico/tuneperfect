import { createMemo, Show } from "solid-js";

import { getGapTolerance } from "~/lib/game/pitch";
import { t } from "~/lib/i18n";
import { isRap, type Note } from "~/lib/ultrastar/note";
import { clamp } from "~/lib/utils/math";
import { settingsStore } from "~/stores/settings";

/** Clip for a completely filled bar. */
const FULL_FILL = "none";

interface SungFillProps {
  note: Note;
  /** Beats sung so far, which grows while the note is sung. */
  length: number;
  delayedBeat: number;
  micColor: string;
  rawMidiNotes: number[];
  sungMidiNote: number;
}

/**
 * The sung part of a note, filling the box it's placed in (the note bar's): it grows with the
 * singer's beat and carries the accuracy line. Both singing views draw sung notes with it.
 */
export default function SungFill(props: SungFillProps) {
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
    // Outline (0.22cqw) + a 0.2cqw gap before the sung fill.
    <div class="h-full w-full p-[0.42cqw]">
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
  );
}
