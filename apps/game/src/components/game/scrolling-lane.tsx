import { Key } from "@solid-primitives/keyed";
import { createMemo, createRenderEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js";

import { useGame } from "~/lib/game/game-context";
import { getGapTolerance } from "~/lib/game/pitch";
import { usePlayer } from "~/lib/game/player-context";
import { addProcessedBeat, type ProcessedNoteGroup } from "~/lib/game/processed-notes";
import { cameraAt } from "~/lib/game/scrolling/camera";
import { layoutLyrics, type LyricSlot } from "~/lib/game/scrolling/lyric-slots";
import { buildLaneTimeline, type LaneNote, visibleRange } from "~/lib/game/scrolling/timeline";
import {
  buildTrail,
  medianOfThree,
  placeSungPitch,
  type TrailPoint,
  type TrailSegment,
} from "~/lib/game/scrolling/trail";
import { beatToMs, beatToMsWithoutGap } from "~/lib/ultrastar/bpm";
import { isRap, type Note } from "~/lib/ultrastar/note";
import { frequencyToMidi } from "~/lib/utils/midi";
import { settingsStore } from "~/stores/settings";

import NoteBar from "./note-bar";
import SungFill from "./sung-fill";

/** How far ahead of the now-line notes show, and how long they stay behind it. */
const AHEAD_MS = 4200;
const BEHIND_MS = 2100;
const WINDOW_MS = AHEAD_MS + BEHIND_MS;
/** Notes enter and leave the DOM this far outside the visible window. */
const OVERSCAN_MS = 400;
/** How long the trail follows the voice. */
const TRAIL_MS = 600;
/** The cursor hides when the voice has been silent this long. */
const CURSOR_TIMEOUT_MS = 150;
/** The trail fades in this many steps, one path each. */
const TRAIL_STEPS = 6;

/**
 * The scrolling singing view's lane: the player's notes scroll right to left past a now-line on
 * the left third, the way they're heard, with a cursor and a short trail following the voice.
 *
 * It draws the same note bars and sung fills as the classic lane. Everything per frame happens in
 * one effect that writes transforms and a few path attributes, so frames cost no layout.
 */
export default function ScrollingLane() {
  const game = useGame();
  const player = usePlayer();
  // Fixed per round, like the classic lane.
  const compact = game.playerCount() > 2;
  const rows = compact ? 12 : 16;
  const margin = compact ? 1 : 2;

  let area!: HTMLDivElement;
  let track!: HTMLDivElement;
  let cursor!: HTMLDivElement;
  let syllableProbe!: HTMLSpanElement;
  const trailPaths: SVGPathElement[] = [];
  const [size, setSize] = createSignal({ width: 0, height: 0 });

  onMount(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    observer.observe(area);
    onCleanup(() => observer.disconnect());
  });

  const pxPerMs = () => size().width / WINDOW_MS;
  const rowHeight = () => size().height / rows;
  const nowX = () => (size().width * BEHIND_MS) / WINDOW_MS;
  /** A bar spans two rows, centred on its pitch, like the classic lane's. */
  const barHeight = () => rowHeight() * 2;

  const timeline = createMemo(() => {
    const song = game.song();
    const voice = player.voice();
    return song && voice ? buildLaneTimeline(song, voice, { rows, margin }) : undefined;
  });

  const laneNoteOf = createMemo(() => new Map<Note, LaneNote>(timeline()?.notes.map((n) => [n.note, n]) ?? []));

  /** The notes near the visible window; only changes when one enters or leaves. */
  const visibleNotes = createMemo(
    () => {
      const notes = timeline()?.notes ?? [];
      const now = game.ms();
      const [start, end] = visibleRange(notes, now - BEHIND_MS - OVERSCAN_MS, now + AHEAD_MS + OVERSCAN_MS);
      return { notes, start, end };
    },
    undefined,
    { equals: (a, b) => a?.notes === b.notes && a.start === b.start && a.end === b.end },
  );
  const shownNotes = createMemo(() => {
    const { notes, start, end } = visibleNotes();
    return notes.slice(start, end);
  });

  // Syllables under their notes, laid out once per size: measured with the lane's own font.
  const syllables = createMemo(() => {
    const notes = timeline()?.notes ?? [];
    const scale = pxPerMs();
    if (scale === 0) return new Map<LaneNote, LyricSlot>();
    const context = document.createElement("canvas").getContext("2d");
    const style = getComputedStyle(syllableProbe);
    if (context) context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
    const measure = (text: string) => context?.measureText(text).width ?? text.length * 10;
    const lyrics = notes.map((n) => ({ startMs: n.startMs, endMs: n.endMs, text: n.note.text }));
    const slots = layoutLyrics(lyrics, scale, measure, parseFloat(style.fontSize) * 0.3);
    return new Map(slots.map((slot) => [notes[slot.index]!, slot]));
  });

  // Sung beats grouped into fills, built incrementally like the classic lane's. Only hits get a
  // fill: misses show in the trail while they're sung, and leave nothing behind.
  let grouped: { groups: ProcessedNoteGroup[]; nextBeat: number } = { groups: [], nextBeat: -Infinity };
  const fills = createMemo(
    () => {
      const upTo = Math.floor(player.delayedBeat());
      let groups = grouped.groups;
      if (grouped.nextBeat === -Infinity) grouped.nextBeat = Math.floor(timeline()?.notes[0]?.note.startBeat ?? 0);
      for (let i = grouped.nextBeat; i <= upTo; i++) {
        const beat = player.processedBeats.get(i);
        if (!beat) continue;
        if (!isRap(beat.note) && beat.midiNote !== beat.note.midiNote) continue;
        if (groups === grouped.groups) groups = groups.slice();
        addProcessedBeat(groups, i, beat, 0, () => 0);
      }
      grouped = { groups, nextBeat: Math.max(grouped.nextBeat, upTo + 1) };
      return groups;
    },
    [],
    { equals: (a, b) => a === b },
  );
  const shownFills = createMemo(() => {
    const song = game.song();
    if (!song) return [];
    const now = game.ms();
    return fills().filter((group) => beatToMs(song, group.beat + group.length) >= now - BEHIND_MS - OVERSCAN_MS);
  });

  /** Where a pitch sits vertically in the track (row centres, before the camera's offset). */
  const pitchY = (midi: number) => -midi * rowHeight();

  // Everything that moves each frame.
  const tolerance = getGapTolerance(settingsStore.general().difficulty);
  const midis: number[] = [];
  const points: TrailPoint[] = [];
  createRenderEffect(() => {
    const now = game.ms();
    const plan = timeline()?.camera;
    if (!plan || size().width === 0) return;

    const camera = cameraAt(plan, now);
    const trackY = (camera - Math.floor(rows / 2) + rows - 0.5) * rowHeight();
    track.style.transform = `translate3d(${nowX() - now * pxPerMs()}px, ${trackY}px, 0)`;

    // The voice: frames are in capture time; shifted by the mic delay they line up with the notes.
    const pitch = game.pitchTimeline?.(player.index());
    const delay = player.microphone().delay;
    const notes = timeline()?.notes ?? [];
    midis.length = 0;
    points.length = 0;
    const times: number[] = [];
    pitch?.forEachInRange(now + delay - TRAIL_MS, now + delay, (time, hz) => {
      if (hz <= 0) {
        // Silence: a break in the trail.
        times.push(Number.NaN);
        midis.push(Number.NaN);
        return;
      }
      times.push(time - delay);
      midis.push(frequencyToMidi(hz));
    });
    for (let i = 0; i < times.length; i++) {
      const time = times[i]!;
      if (Number.isNaN(time)) continue;
      const midi =
        Number.isNaN(midis[i - 1] ?? 0) || Number.isNaN(midis[i + 1] ?? 0) ? midis[i]! : medianOfThree(midis, i);
      const [index] = visibleRange(notes, time, time);
      const note = notes[index]?.startMs !== undefined && notes[index]!.startMs <= time ? notes[index] : undefined;
      const target = note && !note.freestyle ? note.displayMidi : undefined;
      points.push({ time, midi: placeSungPitch(midi, target, camera, tolerance), note });
    }

    // The live end: the newest frame reaches the now-line, closing the mic delay's gap.
    const latest = points.at(-1);
    const live = latest && latest.time >= now - CURSOR_TIMEOUT_MS;
    if (latest && live) points.push({ ...latest, time: now });

    const segments = buildTrail(points, now, TRAIL_MS);
    // Segments that continue one another form one line, so its joins don't show.
    const paths = Array.from({ length: TRAIL_STEPS }, () => "");
    const ends: (TrailSegment | undefined)[] = [];
    for (const segment of segments) {
      const step = Math.min(TRAIL_STEPS - 1, Math.floor(segment.freshness * TRAIL_STEPS));
      const previous = ends[step];
      const continues = previous?.toTime === segment.fromTime && previous.toMidi === segment.fromMidi;
      if (!continues) paths[step] += `M${segment.fromTime * pxPerMs()} ${pitchY(segment.fromMidi)}`;
      paths[step] += `L${segment.toTime * pxPerMs()} ${pitchY(segment.toMidi)}`;
      ends[step] = segment;
    }
    for (const [step, path] of trailPaths.entries()) path.setAttribute("d", paths[step] ?? "");

    cursor.style.opacity = live ? "1" : "0";
    if (latest && live) cursor.style.transform = `translate(${nowX()}px, ${trackY + pitchY(latest.midi)}px)`;
  });

  return (
    <div class="relative grow overflow-hidden px-48" classList={{ "py-[1cqh]": compact, "py-[2cqh]": !compact }}>
      {/* Lyric text size for syllables, read once for measuring. */}
      <span
        ref={syllableProbe}
        class="invisible absolute font-bold"
        classList={{ "text-[1.2cqw]": compact, "text-[1.5cqw]": !compact }}
      />
      {/* Inset like the classic lane, clear of the name plate and score; notes fade in and out at the sides. */}
      <div ref={area} class="relative h-full w-full overflow-x-clip mask-x-from-95% mask-x-to-100%">
        <div ref={track} class="absolute top-0 left-0 will-change-transform">
          <For each={shownNotes()}>
            {(laneNote) => {
              const slot = () => syllables().get(laneNote);
              const sung = createMemo(() => game.ms() >= laneNote.startMs);
              return (
                <>
                  <Show when={!laneNote.freestyle}>
                    <div
                      class="absolute"
                      style={{
                        left: `${laneNote.startMs * pxPerMs()}px`,
                        width: `${(laneNote.endMs - laneNote.startMs) * pxPerMs()}px`,
                        top: `${pitchY(laneNote.displayMidi) - barHeight() / 2}px`,
                        height: `${barHeight()}px`,
                      }}
                    >
                      <NoteBar note={laneNote.note} />
                    </div>
                  </Show>
                  <Show when={slot()}>
                    {(slot) => (
                      <span
                        class="absolute font-bold whitespace-nowrap transition-colors duration-150"
                        classList={{
                          "text-[1.2cqw]": compact,
                          "text-[1.5cqw]": !compact,
                          italic: laneNote.freestyle,
                          "text-white/90": !sung() && !laneNote.freestyle,
                          "text-white/45": laneNote.freestyle,
                        }}
                        style={{
                          left: `${slot().x}px`,
                          top: `${pitchY(laneNote.displayMidi) + barHeight() / 2 + slot().line * rowHeight() * 1.6}px`,
                          color: sung() && !laneNote.freestyle ? player.micColor(500) : undefined,
                        }}
                      >
                        {slot().text}
                      </span>
                    )}
                  </Show>
                </>
              );
            }}
          </For>

          <Key each={shownFills()} by={(group) => group.beat}>
            {(group) => {
              const song = game.song()!;
              const laneNote = () => laneNoteOf().get(group().note);
              return (
                <Show when={laneNote()}>
                  {(laneNote) => (
                    <div
                      class="absolute"
                      style={{
                        left: `${beatToMs(song, group().beat) * pxPerMs()}px`,
                        width: `${beatToMsWithoutGap(song, group().length) * pxPerMs()}px`,
                        top: `${pitchY(laneNote().displayMidi) - barHeight() / 2}px`,
                        height: `${barHeight()}px`,
                      }}
                    >
                      <SungFill
                        note={group().note}
                        length={group().length}
                        delayedBeat={player.delayedBeat()}
                        micColor={player.micColor(500)}
                        rawMidiNotes={group().rawMidiNotes}
                        sungMidiNote={group().midiNote}
                      />
                    </div>
                  )}
                </Show>
              );
            }}
          </Key>

          <svg class="pointer-events-none absolute top-0 left-0 overflow-visible" aria-hidden="true">
            {Array.from({ length: TRAIL_STEPS }, (_, step) => {
              const freshness = (step + 1) / TRAIL_STEPS;
              return (
                <path
                  ref={(path) => (trailPaths[step] = path)}
                  fill="none"
                  stroke={player.micColor(500)}
                  // Round ends only on the newest part: semi-transparent caps overlapping the
                  // next part would show as beads.
                  stroke-linecap={step === TRAIL_STEPS - 1 ? "round" : "butt"}
                  stroke-linejoin="round"
                  stroke-opacity={0.15 + 0.85 * freshness}
                  stroke-width={rowHeight() * (0.25 + 0.45 * freshness)}
                />
              );
            })}
          </svg>
        </div>

        {/* The now-line, and the voice's cursor on it. */}
        <div
          class="absolute inset-y-0 w-[0.22cqw] -translate-x-1/2 rounded-full bg-white/70"
          style={{ left: `${nowX()}px` }}
        />
        <div
          ref={cursor}
          class="absolute top-0 left-0 -mt-[0.7cqw] -ml-[0.7cqw] size-[1.4cqw] rounded-full border-[0.3cqw] bg-white opacity-0"
          style={{ "border-color": player.micColor(500) }}
        />
      </div>
    </div>
  );
}
