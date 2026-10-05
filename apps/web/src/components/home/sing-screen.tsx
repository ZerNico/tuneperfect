import { createSignal, For, Index, onMount, Show } from "solid-js";

import { clamp, prefersReducedMotion, useFrame, useInView } from "~/lib/motion";

import { SHOTS } from "./screen";

interface Note {
  /** Start and length as a fraction of the line. */
  start: number;
  length: number;
  /** Row from the bottom, 0 to 8. */
  pitch: number;
  golden?: boolean;
  syllable: string;
}

type Tier = "perfect" | "great" | "good";

interface Singer {
  name: string;
  avatar: string;
  /** Mic colour, a Tailwind colour name. */
  color: string;
  score: number;
  combo: number;
  /** Per line: the rating, and the notes where they slipped (note index to the share they got on pitch). */
  lines: { tier: Tier; bonus?: boolean; slips?: Record<number, number> }[];
}

interface ComboEvent {
  id: number;
  combo: number;
  hit: boolean;
  /** The combo this note broke. */
  broken?: number;
}

/** Shorter combos aren't shown, like in the game. */
const MIN_VISIBLE_COMBO = 3;
const TIER_LABEL: Record<Tier, string> = { perfect: "Perfect", great: "Great", good: "Good" };

// Our own little tune, so no lyrics need licensing.
const LINES: Note[][] = [
  [
    { start: 0, length: 0.1, pitch: 3, syllable: "Grab " },
    { start: 0.13, length: 0.08, pitch: 4, syllable: "the " },
    { start: 0.24, length: 0.12, pitch: 6, syllable: "mic " },
    { start: 0.39, length: 0.08, pitch: 4, syllable: "and " },
    { start: 0.5, length: 0.15, pitch: 3, golden: true, syllable: "sing " },
    { start: 0.68, length: 0.08, pitch: 1, syllable: "it " },
    { start: 0.79, length: 0.21, pitch: 3, syllable: "loud" },
  ],
  [
    { start: 0, length: 0.12, pitch: 1, syllable: "Ev" },
    { start: 0.15, length: 0.08, pitch: 3, syllable: "ery " },
    { start: 0.26, length: 0.12, pitch: 4, syllable: "note, " },
    { start: 0.42, length: 0.08, pitch: 6, syllable: "ev" },
    { start: 0.53, length: 0.08, pitch: 8, syllable: "ery " },
    { start: 0.64, length: 0.36, pitch: 6, golden: true, syllable: "line" },
  ],
  [
    { start: 0, length: 0.08, pitch: 6, syllable: "Hit " },
    { start: 0.11, length: 0.08, pitch: 7, syllable: "the " },
    { start: 0.22, length: 0.16, pitch: 8, golden: true, syllable: "gold " },
    { start: 0.41, length: 0.08, pitch: 7, syllable: "and " },
    { start: 0.52, length: 0.08, pitch: 6, syllable: "take " },
    { start: 0.63, length: 0.08, pitch: 4, syllable: "the " },
    { start: 0.74, length: 0.26, pitch: 3, syllable: "crown" },
  ],
];

const SINGERS: Singer[] = [
  {
    name: "Nina",
    avatar: "bg-orange-500",
    color: "sky",
    score: 412_380,
    combo: 14,
    lines: [{ tier: "perfect", bonus: true }, { tier: "great", slips: { 3: 0.3 } }, { tier: "perfect" }],
  },
  {
    name: "Steve",
    avatar: "bg-green-500",
    color: "red",
    score: 386_910,
    combo: 9,
    lines: [{ tier: "good", slips: { 1: 0.4, 5: 0.2 } }, { tier: "perfect" }, { tier: "great", slips: { 4: 0.35 } }],
  },
];

/** A line is sung over the first part of its time, the rest is the pause before the next one. */
const LINE_MS = 6200;
const SUNG = 0.8;
const SONG_MS = 3 * 60_000;
const START_MS = 61_000;

const format = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
};

const mic = (singer: Singer) => `var(--color-${singer.color}-500)`;

/** The game's lyrics bar, rounded towards the middle of the screen and filling in its singer's colour. */
function Lyrics(props: { position: "top" | "bottom"; singer: Singer; line: Note[]; next: Note[]; sung: number }) {
  return (
    <div
      class="absolute inset-x-0 bg-black/65 text-center"
      classList={{
        "top-0 rounded-b-[1cqw] pt-[0.7cqw] pb-[0.45cqw]": props.position === "top",
        "bottom-0 rounded-t-[1cqw] pt-[0.8cqw] pb-[1cqw]": props.position === "bottom",
      }}
    >
      <div class="text-[2.4cqw] leading-snug font-bold">
        <For each={props.line}>
          {(note) => {
            const share = () => clamp((props.sung - note.start) / note.length) * 100;
            return (
              <span
                class="inline-block bg-clip-text whitespace-pre text-transparent"
                style={{
                  "background-image": `linear-gradient(to right, ${mic(props.singer)} ${share()}%, white ${share()}%)`,
                }}
              >
                {note.syllable}
              </span>
            );
          }}
        </For>
      </div>
      <div class="text-[1.9cqw] leading-tight font-bold text-white/45">
        {props.next.map((note) => note.syllable).join("")}
      </div>
    </div>
  );
}

/** The game's singing screen with two singers, playing by itself: notes filling in, a rating after every line. */
export default function SingScreen() {
  const [element, setElement] = createSignal<HTMLDivElement>();
  const inView = useInView(element);

  const [line, setLine] = createSignal(0);
  const [progress, setProgress] = createSignal(0.55);
  const [rated, setRated] = createSignal<number | null>(null);
  const [elapsed, setElapsed] = createSignal(START_MS);
  // Like the game: a note counts as hit when more than half of it was on pitch. Every finished note is an event,
  // so the chip pops on each hit and a broken combo shows crossed out before it goes.
  const lanes = SINGERS.map((singer) => {
    const [score, setScore] = createSignal(singer.score);
    const [combo, setCombo] = createSignal<ComboEvent>({ id: 0, combo: singer.combo, hit: true });
    return { singer, score, setScore, combo, setCombo };
  });

  let lineStart: number | undefined;
  let finished = new Set<number>();
  let eventId = 0;
  let clock: number | undefined;
  let reduced = false;
  onMount(() => (reduced = prefersReducedMotion()));

  const current = () => LINES[line()]!;
  const next = () => LINES[(line() + 1) % LINES.length]!;
  /** Where the singers are within the sung part of the line, 0 to 1. */
  const sung = () => clamp(progress() / SUNG);
  const take = (singer: Singer) => singer.lines[line()]!;

  useFrame((_, now) => {
    if (reduced) return;
    lineStart ??= now - progress() * LINE_MS;
    // Frames pause off screen: cap the step so the clock doesn't jump when it comes back.
    const step = Math.min(now - (clock ?? now), 100);
    clock = now;
    setElapsed((value) => (value + step) % SONG_MS);
    let value = (now - lineStart) / LINE_MS;
    if (value >= 1) {
      setLine((index) => (index + 1) % LINES.length);
      setRated(null);
      finished = new Set();
      lineStart = now;
      value = 0;
    }
    const before = sung();
    setProgress(value);
    const gained = sung() > before && sung() < 1 ? sung() - before : 0;
    current().forEach((note, index) => {
      if (finished.has(index) || sung() < note.start + note.length) return;
      finished.add(index);
      for (const lane of lanes) {
        const count = lane.combo().hit ? lane.combo().combo : 0;
        lane.setCombo(
          (take(lane.singer).slips?.[index] ?? 1) > 0.5
            ? { id: ++eventId, combo: count + 1, hit: true }
            : { id: ++eventId, combo: 0, hit: false, broken: count },
        );
      }
    });
    for (const lane of lanes) {
      if (gained) lane.setScore((total) => total + Math.round(gained * (lane.singer.name === "Nina" ? 9_000 : 8_200)));
    }
    if (sung() >= 1 && rated() !== line()) {
      setRated(line());
      for (const lane of lanes) {
        if (take(lane.singer).bonus) lane.setScore((total) => total + 2_500);
      }
    }
  }, inView);

  /** How much of a note is filled: up to where the singer is, or where they slipped. */
  const fill = (singer: Singer, note: Note, index: number) => {
    const share = clamp((sung() - note.start) / note.length);
    return Math.min(share, take(singer).slips?.[index] ?? 1);
  };
  const leader = () => lanes.reduce((best, lane) => (lane.score() > best.score() ? lane : best)).singer;
  const y = (pitch: number) => `${(1 - pitch / 8) * 100}%`;

  return (
    <div ref={setElement} class="absolute inset-0 overflow-hidden" aria-hidden="true">
      {/* The game's combo bump: a quick scale, no fade. */}
      <style>{"@keyframes score-pop { 50% { transform: scale(1.08) } }"}</style>
      <img
        src={SHOTS.singGroup}
        alt=""
        loading="lazy"
        class="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-[1.4cqw]"
      />
      <div class="absolute inset-0 bg-[rgb(16_16_36/0.35)]" />

      {/* Each half follows its singer: lyrics on the outside, notes, then name, combo and score towards the middle. */}
      <Lyrics position="top" singer={SINGERS[0]!} line={current()} next={next()} sung={sung()} />
      <Lyrics position="bottom" singer={SINGERS[1]!} line={current()} next={next()} sung={sung()} />

      <For each={lanes}>
        {(lane, index) => {
          const top = () => index() === 0;
          return (
            <>
              {/* Notes: outlined bars, golden ones in yellow, filled in the singer's colour as they're sung. */}
              <div
                class="absolute right-[11%] left-[11%] h-[21%]"
                classList={{ "top-[18%]": top(), "top-[59%]": !top() }}
              >
                <For each={[line()]}>
                  {() => (
                    <Index each={current()}>
                      {(note, noteIndex) => (
                        <div
                          class="absolute h-[2.15cqw] -translate-y-1/2 animate-[rise_0.3s_ease-out_both]"
                          style={{
                            left: `${note().start * 100}%`,
                            width: `${note().length * 100}%`,
                            top: y(note().pitch),
                          }}
                        >
                          <div
                            class="size-full rounded-full border-[0.22cqw] shadow-[0_0.15cqw_0_rgb(0_0_0/0.3)]"
                            classList={{
                              "border-yellow-300 bg-yellow-300/25": note().golden,
                              "border-white bg-black/35": !note().golden,
                            }}
                          />
                          <div class="absolute inset-0 p-[0.42cqw]">
                            <div
                              class="size-full rounded-full"
                              style={{
                                "background-color": mic(lane.singer),
                                "clip-path": `inset(0 ${100 - fill(lane.singer, note(), noteIndex) * 100}% 0 0 round 9999px)`,
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </Index>
                  )}
                </For>
              </div>

              {/* The rating for the line that was just sung, on the right of the lane. */}
              <Show when={rated() === line()}>
                <div
                  class="absolute right-[3%] flex -translate-y-1/2 flex-col items-center gap-[0.5cqw]"
                  classList={{ "top-[29%]": top(), "top-[69%]": !top() }}
                >
                  <span
                    class="animate-[pop_0.25s_ease-out_both] rounded-[0.8cqw] px-[1.4cqw] py-[0.3cqw] text-[1.9cqw] font-black shadow-[0_0.15cqw_0_rgb(0_0_0/0.3)] [text-shadow:0_0.06em_0_rgb(0_0_0/0.3)]"
                    classList={{ "scale-110": take(lane.singer).tier === "perfect" }}
                    style={{
                      "background-color":
                        take(lane.singer).tier === "perfect" ? "var(--color-yellow-400)" : mic(lane.singer),
                    }}
                  >
                    {TIER_LABEL[take(lane.singer).tier]}
                  </span>
                  <Show when={take(lane.singer).bonus}>
                    <span class="animate-[pop_0.25s_ease-out_0.1s_both] rounded-[0.3em] bg-white px-[0.5em] py-[0.1em] text-[1cqw] font-black tracking-wide text-slate-900 uppercase">
                      +Bonus
                    </span>
                  </Show>
                </div>
              </Show>

              {/* The singer: avatar and name tag on the left, combo and score on the right. */}
              <div
                class="absolute inset-x-[3%] flex -translate-y-1/2 items-center justify-between"
                classList={{ "top-[42%]": top(), "top-[55.5%]": !top() }}
              >
                <div class="flex items-center gap-[0.7cqw]">
                  <span
                    class={`flex size-[2.6cqw] items-center justify-center rounded-full text-[1.4cqw] font-black ${lane.singer.avatar}`}
                  >
                    {lane.singer.name[0]}
                  </span>
                  <span class="rounded-[0.4cqw] bg-white px-[0.6cqw] py-[0.45cqw] text-[1.15cqw] leading-none font-black text-slate-900">
                    {lane.singer.name}
                  </span>
                </div>
                <div class="flex items-center gap-[1cqw]">
                  <Show when={lane.combo()} keyed>
                    {(event) => (
                      <Show when={(event.hit ? event.combo : (event.broken ?? 0)) >= MIN_VISIBLE_COMBO}>
                        <span
                          class="flex items-center gap-[0.4em] rounded-[0.5cqw] bg-black/55 px-[0.6em] py-[0.2em] text-[1.15cqw] leading-tight"
                          classList={{
                            "animate-[score-pop_0.2s_ease-out]": event.hit,
                            "animate-[fade-out-up_0.3s_ease-in_0.6s_forwards] opacity-60 grayscale": !event.hit,
                          }}
                        >
                          <span class="font-semibold text-white/70">Combo</span>
                          <span
                            class="font-black tabular-nums"
                            classList={{ "text-white/80 line-through": !event.hit }}
                            style={{ color: event.hit ? mic(lane.singer) : undefined }}
                          >
                            {event.hit ? event.combo : event.broken}
                          </span>
                        </span>
                      </Show>
                    )}
                  </Show>
                  <span
                    class="text-[3cqw] font-black tracking-[-0.01em] tabular-nums [text-shadow:0_0.15cqw_0_rgb(0_0_0/0.35)]"
                    style={{ color: mic(lane.singer) }}
                  >
                    {lane.score().toLocaleString("en-US")}
                  </span>
                </div>
              </div>
            </>
          );
        }}
      </For>

      {/* Song progress, between the two halves, in the leading singer's colour. */}
      <div class="absolute inset-x-[3%] top-[49.2%] grid -translate-y-1/2 grid-cols-[auto_1fr_auto] items-center gap-[1cqw]">
        <span class="text-[0.9cqw] font-black tabular-nums">{format(elapsed())}</span>
        <div class="h-[0.5cqw] overflow-hidden rounded-full bg-white/20">
          <div
            class="h-full rounded-full transition-colors duration-500"
            style={{ width: `${(elapsed() / SONG_MS) * 100}%`, "background-color": mic(leader()) }}
          />
        </div>
        <span class="text-[0.9cqw] font-black text-white/60 tabular-nums">-{format(SONG_MS - elapsed())}</span>
      </div>
    </div>
  );
}
