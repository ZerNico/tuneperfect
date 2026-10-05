import { createEffect, createSignal, Index, onCleanup, onMount, Show } from "solid-js";

import { prefersReducedMotion, useInView } from "~/lib/motion";

import { Cover, SONGS } from "./versus-screen";

type Mark = "x" | "o";

/** One scripted game: X takes the top row. Each move first shows whose turn it is and the song, then claims. */
const MOVES: [number, Mark][] = [
  [0, "x"],
  [4, "o"],
  [2, "x"],
  [5, "o"],
  [1, "x"],
];
const LINE = [0, 1, 2];
const FINAL: (Mark | null)[] = ["x", "x", "x", null, "o", "o", null, null, null];
const STEP_MS = 1500;
const HOLD_MS = 3000;

/** The game's X and O: white outline, coloured core. */
function Glyph(props: { mark: Mark; class?: string }) {
  return (
    <svg viewBox="0 0 100 100" class={props.class} aria-hidden="true">
      <Show
        when={props.mark === "x"}
        fallback={
          <>
            <circle cx="50" cy="50" r="26" fill="none" stroke="white" stroke-width="22" />
            <circle cx="50" cy="50" r="26" fill="none" stroke="var(--color-red-400)" stroke-width="11" />
          </>
        }
      >
        <path d="M28 28 L72 72 M72 28 L28 72" stroke="white" stroke-width="22" stroke-linecap="round" />
        <path d="M28 28 L72 72 M72 28 L28 72" stroke="var(--color-sky-400)" stroke-width="11" stroke-linecap="round" />
      </Show>
    </svg>
  );
}

/** Tic Tac Toe, running by itself: two teams take turns claiming covers until X gets a line. */
export default function TttScreen() {
  const [element, setElement] = createSignal<HTMLDivElement>();
  const inView = useInView(element, "-15% 0px");
  const [board, setBoard] = createSignal<(Mark | null)[]>(Array(9).fill(null));
  const [step, setStep] = createSignal(0);
  const [won, setWon] = createSignal(false);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running = false;
  onCleanup(() => clearTimeout(timer));

  onMount(() => {
    if (!prefersReducedMotion()) return;
    setBoard(FINAL);
    setStep(MOVES.length);
    setWon(true);
  });

  const tick = () => {
    if (!inView()) {
      running = false;
      return;
    }
    if (won()) {
      setBoard(Array(9).fill(null));
      setWon(false);
      setStep(0);
    } else {
      const [cell, mark] = MOVES[step()]!;
      const next = [...board()];
      next[cell] = mark;
      setBoard(next);
      setStep(step() + 1);
      if (step() === MOVES.length) setWon(true);
    }
    timer = setTimeout(tick, won() ? HOLD_MS : STEP_MS);
  };

  createEffect(() => {
    if (inView() && !running && !prefersReducedMotion()) {
      running = true;
      timer = setTimeout(tick, STEP_MS);
    }
  });

  const turn = (): Mark => (won() ? "x" : (MOVES[step()]?.[1] ?? "x"));
  const song = () => SONGS[(MOVES[Math.min(step(), MOVES.length - 1)]![0] * 3 + 1) % SONGS.length]!;
  const center = (index: number) => ({ x: (index % 3) * 100 + 50, y: Math.floor(index / 3) * 100 + 50 });

  return (
    <div ref={setElement} class="absolute inset-0" aria-hidden="true">
      <div class="absolute top-[-10%] left-[0%] h-[60%] w-[45%] rounded-full bg-sky-500/20 blur-[8cqw]" />
      <div class="absolute right-[0%] bottom-[-10%] h-[60%] w-[45%] rounded-full bg-purple-600/25 blur-[8cqw]" />
      <span class="absolute top-[4.5cqw] left-[4cqw] text-[2.6cqw] font-bold">Tic Tac Toe</span>

      <div class="absolute top-[11cqw] left-[8cqw] grid w-[36cqw] grid-cols-3 gap-[1.2cqw]">
        <Index each={board()}>
          {(mark, index) => (
            <div class="relative aspect-square overflow-hidden rounded-[1.2cqw] shadow-crisp">
              <Cover index={index * 3 + 1} />
              <Show when={mark()}>
                {(placed) => (
                  <div
                    class="absolute inset-0 flex animate-[pop_0.25s_ease-out_both] items-center justify-center"
                    classList={{
                      "bg-linear-to-br from-sky-600 to-blue-900": placed() === "x",
                      "bg-linear-to-br from-red-600 to-red-900": placed() === "o",
                    }}
                  >
                    <Glyph mark={placed()} class="size-[70%]" />
                  </div>
                )}
              </Show>
            </div>
          )}
        </Index>
        <Show when={won()}>
          <svg viewBox="0 0 300 300" class="pointer-events-none absolute inset-0 size-full">
            <line
              x1={center(LINE[0]!).x}
              y1={center(LINE[0]!).y}
              x2={center(LINE[2]!).x}
              y2={center(LINE[2]!).y}
              stroke="white"
              stroke-width="10"
              stroke-linecap="round"
              stroke-dasharray="400"
              class="animate-[draw-line_0.45s_ease-out_both]"
            />
          </svg>
        </Show>
      </div>

      <div class="absolute top-[14cqw] right-[6cqw] flex w-[40cqw] flex-col gap-[3cqw]">
        <div
          class="flex items-center gap-[1.6cqw] rounded-[1.6cqw] px-[2cqw] py-[1.6cqw] shadow-crisp transition-colors duration-300"
          classList={{
            "bg-linear-to-r from-sky-500 to-blue-700": turn() === "x",
            "bg-linear-to-r from-red-500 to-red-700": turn() === "o",
          }}
        >
          <Glyph mark={turn()} class="size-[6cqw] shrink-0" />
          <div class="flex flex-col">
            <span class="text-[3.2cqw] leading-tight font-bold">
              {won() ? "X wins!" : `${turn().toUpperCase()}'s turn`}
            </span>
            <span class="text-[1.5cqw] font-bold text-white/75">
              {won() ? "Three in a row" : "Pick a cell to sing for"}
            </span>
          </div>
        </div>
        <Show when={!won()}>
          <div class="flex flex-col">
            <span class="text-[1.6cqw] font-bold text-white/65">{song()[0]}</span>
            <span class="text-[3.4cqw] leading-tight font-bold">{song()[1]}</span>
          </div>
        </Show>
      </div>
    </div>
  );
}
