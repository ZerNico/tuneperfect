import { Key } from "@solid-primitives/keyed";
import { createMemo, createRenderEffect, createSignal, For, onCleanup, onMount, Show } from "solid-js";

import { effectsEnabled } from "~/lib/fx";
import { useGame } from "~/lib/game/game-context";
import { getGapTolerance } from "~/lib/game/pitch";
import { usePlayer } from "~/lib/game/player-context";
import { addProcessedBeat, type ProcessedNoteGroup } from "~/lib/game/processed-notes";
import { cameraAt } from "~/lib/game/scrolling/camera";
import { layoutLyrics, type LyricSlot } from "~/lib/game/scrolling/lyric-slots";
import { buildLaneTimeline, type LaneNote, visibleRange } from "~/lib/game/scrolling/timeline";
import {
  buildTrail,
  carryToNow,
  MAX_GAP_MS,
  placeSungPitch,
  springTowards,
  type Spring,
  steadyPitches,
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
const AHEAD_MS = 3200;
const BEHIND_MS = 1000;
const WINDOW_MS = AHEAD_MS + BEHIND_MS;
/** Notes enter and leave the DOM this far outside the visible window. */
const OVERSCAN_MS = 400;
/** How long the trail follows the voice. */
const TRAIL_MS = 600;
/** The cursor dims and the trail stops when the voice has been silent this long. */
const CURSOR_TIMEOUT_MS = 150;
/** How quickly the cursor follows the voice (spring time; it settles in about four times this). */
const CURSOR_SPRING_MS = 22;
/** The cursor follows the median of this many of the newest points, which drops stray frames. */
const CURSOR_POINTS = 5;
/** Sparkles drift off the cursor while on the note: how many at most, how long each lives, and
 *  how often a new one starts (all in song time). */
const SPARKLES = 24;
const SPARKLE_LIFE_MS = 550;
const SPARKLE_EVERY_MS = 30;
/** The trail fades in this many steps, one path each. */
const TRAIL_STEPS = 6;

/**
 * The scrolling singing view's lane: the player's notes scroll right to left past a now-line on
 * the left third, the way they're heard, with a cursor and a short trail following the voice.
 *
 * It draws the same note bars and sung fills as the classic lane. Everything per frame happens in
 * one effect that writes transforms and a few path attributes, so frames cost no layout.
 */
/** The voice's newest pitch for the cursor: the median of the newest points, since it last started. */
function recentPitch(points: readonly TrailPoint[]): number {
  const recent = [points.at(-1)!.midi];
  for (let i = points.length - 2; i >= 0 && recent.length < CURSOR_POINTS; i--) {
    if (points[i + 1]!.time - points[i]!.time > MAX_GAP_MS) break;
    recent.push(points[i]!.midi);
  }
  recent.sort((a, b) => a - b);
  return recent[Math.floor(recent.length / 2)]!;
}

/** The note sung at `time` if any, and otherwise the one closest in time. */
function noteNear(notes: LaneNote[], time: number): { note: LaneNote | undefined; on: boolean } {
  const [index] = visibleRange(notes, time, time);
  const next = notes[index];
  if (next && next.startMs <= time) return { note: next, on: true };
  const previous = notes[index - 1];
  if (!previous || (next && next.startMs - time < time - previous.endMs)) return { note: next, on: false };
  return { note: previous, on: false };
}

export default function ScrollingLane() {
  const game = useGame();
  const player = usePlayer();
  // Fixed per round, like the classic lane. More rows than the classic lane's, with slimmer bars:
  // with time running sideways, the tune reads best as a flat line, like Let's Sing's.
  const compact = game.playerCount() > 2;
  const rows = compact ? 18 : 24;
  const margin = compact ? 2 : 3;

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
  /** A bar is centred on its pitch, almost two semitone steps tall (neighbours may overlap). */
  const barHeight = () => rowHeight() * 1.9;

  /** Where a pitch sits vertically in the track (row centres, before the camera's offset). */
  const pitchY = (midi: number) => -midi * rowHeight();

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
    const fontSize = parseFloat(style.fontSize);
    const lyrics = notes.map((n) => ({
      startMs: n.startMs,
      endMs: n.endMs,
      text: n.note.text,
      top: pitchY(n.displayMidi) - barHeight() / 2,
      bottom: pitchY(n.displayMidi) + barHeight() / 2,
      bar: !n.freestyle,
    }));
    const slots = layoutLyrics(lyrics, { pxPerMs: scale, lineHeight: fontSize * 1.2, gap: fontSize * 0.3 }, measure);
    return new Map(slots.map((slot) => [notes[slot.index]!, slot]));
  });

  // Sung beats grouped into fills, built incrementally like the classic lane's. Only hits get a
  // fill: misses show in the trail while they're sung, and leave nothing behind.
  let grouped: { groups: ProcessedNoteGroup[]; nextBeat: number } = { groups: [], nextBeat: -Infinity };
  const fills = createMemo(
    () => {
      const upTo = player.scoredBeat();
      if (upTo === null) return grouped.groups;
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

  // Everything that moves each frame.
  const tolerance = getGapTolerance(settingsStore.general().difficulty);
  const midis: number[] = [];
  const points: TrailPoint[] = [];
  /** The cursor's pitch as shown, easing after the voice; `undefined` until the first frame. */
  let cursorPitch: Spring | undefined;
  let cursorAt = 0;
  let shownState = "";
  const sparkleElements: HTMLDivElement[] = [];
  const sparkles = Array.from({ length: SPARKLES }, () => ({ bornAt: -Infinity, x: 0, y: 0, drift: 0 }));
  let nextSparkle = 0;
  let sparkleAt = -Infinity;
  const effects = effectsEnabled();
  createRenderEffect(() => {
    const now = game.ms();
    const plan = timeline()?.camera;
    if (!plan || size().width === 0) return;

    const camera = cameraAt(plan, now);
    const trackY = (camera - Math.floor(rows / 2) + rows - 0.5) * rowHeight();
    track.style.transform = `translate3d(${nowX() - now * pxPerMs()}px, ${trackY}px, 0)`;

    // The voice, drawn when the mic heard it, so the trail always ends at the cursor on the line.
    // Scoring shifts it back by the mic's delay instead; drawn that way, the trail would end the
    // delay behind the line and leap to the cursor whenever singing starts.
    const pitch = game.pitchTimeline?.(player.index());
    const notes = timeline()?.notes ?? [];
    midis.length = 0;
    points.length = 0;
    const times: number[] = [];
    pitch?.forEachInRange(now - TRAIL_MS, now, (time, hz) => {
      if (hz <= 0) {
        // Silence: a break in the trail.
        times.push(Number.NaN);
        midis.push(Number.NaN);
        return;
      }
      times.push(time);
      midis.push(frequencyToMidi(hz));
    });
    const steady = steadyPitches(midis);
    let previous: TrailPoint | undefined;
    for (let i = 0; i < times.length; i++) {
      const time = times[i]!;
      if (Number.isNaN(time)) {
        previous = undefined;
        continue;
      }
      // On a note it's drawn against that note. Between notes it stays in the octave it was in,
      // or starts in the nearest note's (each phrase is drawn in its own octave).
      const { note, on } = noteNear(notes, time);
      const target = on && note && !note.freestyle ? note.displayMidi : undefined;
      const fallback = previous?.midi ?? note?.displayMidi ?? camera;
      const held = previous?.on === true && previous.midi === target;
      const placed = placeSungPitch(steady[i]!, target, fallback, tolerance, held);
      previous = { time, midi: placed, on: target !== undefined && placed === target };
      points.push(previous);
    }

    // While the voice is live, the cursor on the line glides after the newest pitches (a spring) and the
    // trail runs on to it (frames arrive a few tens of ms late). In silence the trail stops and the
    // cursor waits, dimmed, where the voice last was (in the middle before anything was sung).
    const latest = points.at(-1);
    const live = latest !== undefined && latest.time >= now - CURSOR_TIMEOUT_MS;
    const elapsed = now - cursorAt;
    if (!cursorPitch || elapsed < 0) cursorPitch = { value: camera, velocity: 0 };
    if (latest && live) {
      springTowards(cursorPitch, recentPitch(points), Math.min(elapsed, 100), CURSOR_SPRING_MS);
      carryToNow(points, now, cursorPitch.value);
    } else {
      cursorPitch.velocity = 0;
    }
    cursorAt = now;

    // On the note the trail is drawn as a bar filling it, otherwise as a thin line. Segments that
    // continue one another form one path, so its joins don't show.
    const segments = buildTrail(points, now, TRAIL_MS);
    const paths = trailPaths.map(() => "");
    const ends: (TrailSegment | undefined)[] = [];
    for (const segment of segments) {
      const step = Math.min(TRAIL_STEPS - 1, Math.floor(segment.freshness * TRAIL_STEPS));
      const index = (segment.on ? TRAIL_STEPS : 0) + step;
      const previous = ends[index];
      const continues = previous?.toTime === segment.fromTime && previous.toMidi === segment.fromMidi;
      if (!continues) paths[index] += `M${segment.fromTime * pxPerMs()} ${pitchY(segment.fromMidi)}`;
      paths[index] += `L${segment.toTime * pxPerMs()} ${pitchY(segment.toMidi)}`;
      ends[index] = segment;
    }
    for (const [index, path] of trailPaths.entries()) path.setAttribute("d", paths[index] ?? "");

    // Singing shows at the line: the cursor and line glow while on the note, and a soft wash
    // behind the line is there while the voice is live.
    const state = !live ? "silent" : latest?.on ? "on" : "live";
    if (state !== shownState) {
      shownState = state;
      area.dataset.voice = state;
    }
    // Sparkles start at the cursor and stay where they started on the track, so they trail off
    // with the notes while they fade.
    if (effects) {
      if (state === "on" && (now - sparkleAt >= SPARKLE_EVERY_MS || now < sparkleAt)) {
        sparkleAt = now;
        const sparkle = sparkles[nextSparkle]!;
        nextSparkle = (nextSparkle + 1) % SPARKLES;
        sparkle.bornAt = now;
        sparkle.x = now * pxPerMs();
        sparkle.y = pitchY(cursorPitch.value) + (Math.random() - 0.5) * barHeight() * 0.6;
        // Up or down, a row or two over its life.
        sparkle.drift = ((Math.random() - 0.5) * rowHeight() * 3) / SPARKLE_LIFE_MS;
      }
      for (const [index, sparkle] of sparkles.entries()) {
        const element = sparkleElements[index]!;
        const age = now - sparkle.bornAt;
        if (age < 0 || age > SPARKLE_LIFE_MS) {
          if (element.style.opacity !== "0") element.style.opacity = "0";
          continue;
        }
        const life = 1 - age / SPARKLE_LIFE_MS;
        element.style.opacity = `${life}`;
        element.style.transform = `translate(${sparkle.x}px, ${sparkle.y + sparkle.drift * age}px) scale(${0.4 + 0.6 * life})`;
      }
    }

    cursor.style.opacity = live ? "1" : "0.5";
    cursor.style.transform = `translate(${nowX()}px, ${trackY + pitchY(cursorPitch.value)}px)`;
  });

  return (
    <div class="relative grow overflow-hidden px-48" classList={{ "py-[1cqh]": compact, "py-[2cqh]": !compact }}>
      {/* Lyric text size for syllables, read once for measuring. */}
      <span
        ref={syllableProbe}
        class="invisible absolute font-bold"
        classList={{ "text-[1.1cqw]": compact, "text-[1.3cqw]": !compact }}
      />
      {/* Inset like the classic lane, clear of the name plate and score. Passed notes fade out on
          the left, upcoming ones fade in on the right. */}
      <div ref={area} class="group relative h-full w-full overflow-x-clip mask-r-from-95% mask-l-from-85%">
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
                        class="absolute leading-[1.2] font-bold whitespace-nowrap transition-colors duration-150 [text-shadow:0_0_0.5cqw_rgb(0_0_0/0.55)]"
                        classList={{
                          "text-[1.1cqw]": compact,
                          "text-[1.3cqw]": !compact,
                          italic: laneNote.freestyle,
                          "text-white/90": !sung() && !laneNote.freestyle,
                          // Freestyle has no bar and isn't scored, but is still sung: readable, then dimmed.
                          "text-white/80": laneNote.freestyle && !sung(),
                          "text-white/50": laneNote.freestyle && sung(),
                        }}
                        style={{
                          left: `${slot().x}px`,
                          top: `${slot().y}px`,
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
            {Array.from({ length: TRAIL_STEPS * 2 }, (_, index) => {
              const on = index >= TRAIL_STEPS;
              const step = index % TRAIL_STEPS;
              const freshness = (step + 1) / TRAIL_STEPS;
              return (
                <path
                  ref={(path) => (trailPaths[index] = path)}
                  fill="none"
                  stroke={player.micColor(500)}
                  // Round ends only on the newest part: semi-transparent caps overlapping the
                  // next part would show as beads.
                  stroke-linecap={step === TRAIL_STEPS - 1 ? "round" : "butt"}
                  stroke-linejoin="round"
                  stroke-opacity={on ? 0.3 + 0.7 * freshness : 0.15 + 0.85 * freshness}
                  // On the note, as thick as the sung fill that follows it.
                  stroke-width={on ? barHeight() * 0.7 : rowHeight() * (0.25 + 0.45 * freshness)}
                />
              );
            })}
          </svg>

          <Show when={effects}>
            {Array.from({ length: SPARKLES }, (_, index) => (
              <div
                ref={(element) => (sparkleElements[index] = element)}
                class="absolute top-0 left-0 -mt-[0.25cqw] -ml-[0.25cqw] size-[0.5cqw] rounded-full opacity-0"
                style={{
                  background: `radial-gradient(circle, white 20%, ${player.micColor(300)} 60%, transparent 70%)`,
                }}
              />
            ))}
          </Show>
        </div>

        {/* The now-line with a soft wash behind it while singing, and the voice's cursor on it. */}
        <div
          class="pointer-events-none absolute inset-y-0 w-[5cqw] -translate-x-full opacity-0 transition-opacity duration-200 group-data-[voice=live]:opacity-40 group-data-[voice=on]:opacity-100"
          style={{
            left: `${nowX()}px`,
            "background-image": `linear-gradient(to left, color-mix(in srgb, ${player.micColor(500)} 30%, transparent), transparent)`,
          }}
        />
        <div
          class="absolute inset-y-0 w-[0.22cqw] -translate-x-1/2 rounded-full bg-white/70 transition-shadow duration-200 group-data-[voice=on]:shadow-[0_0_0.8cqw_var(--glow)]"
          style={{ left: `${nowX()}px`, "--glow": player.micColor(500) }}
        />
        <div
          ref={cursor}
          class="absolute top-0 left-0 -mt-[0.7cqw] -ml-[0.7cqw] size-[1.4cqw] rounded-full border-[0.3cqw] bg-white opacity-0 transition-[opacity,box-shadow] duration-200 group-data-[voice=on]:shadow-[0_0_1cqw_var(--glow)]"
          style={{ "border-color": player.micColor(500), "--glow": player.micColor(500) }}
        />
      </div>
    </div>
  );
}
