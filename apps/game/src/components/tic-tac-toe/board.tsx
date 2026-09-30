import { For, Show } from "solid-js";

import { effectsEnabled } from "~/lib/fx";
import { t } from "~/lib/i18n";
import { getColorVar } from "~/lib/utils/color";
import type { Cell, Mark } from "~/stores/party/tic-tac-toe";

import MarkGlyph from "./mark-glyph";

/** Gap between cells as a share of the board width. */
const GAP = 0.03;
/** When the win line has finished drawing, the winning cells pop one after another. */
const POP_START_MS = 900;
const POP_STEP_MS = 120;

interface BoardProps {
  cells: Cell[];
  gridSize: number;
  /** Highlighted cell, or null when nothing is selectable (game over). */
  cursor: number | null;
  winningCells: number[];
  /** Cell claimed by the last round: its mark stamps in. */
  freshCell?: number | null;
  result: Mark | "draw" | null;
  teamColor: (mark: Mark) => string;
  onSelect: (index: number) => void;
  onHover: (index: number) => void;
  /** Sets the board width through `--board`, e.g. `[--board:min(40cqw,64cqh)]`. */
  class?: string;
}

/**
 * Square board of song covers. Claimed cells get the team's sticker mark; when a team wins, a
 * line draws through the winning cells and they pop, while the rest of the board dims.
 */
export default function Board(props: BoardProps) {
  const n = () => props.gridSize;
  // Cell size and centres in percent of the board width (the gap is a fixed share of it).
  const cellSize = () => (100 - (n() - 1) * GAP * 100) / n();
  const centre = (index: number) => ({
    x: (index % n()) * (cellSize() + GAP * 100) + cellSize() / 2,
    y: Math.floor(index / n()) * (cellSize() + GAP * 100) + cellSize() / 2,
  });

  const line = () => {
    const cells = props.winningCells;
    const first = cells[0];
    const last = cells.at(-1);
    if (first === undefined || last === undefined || first === last) return null;
    const a = centre(first);
    const b = centre(last);
    // Run a little past the outer cells so the line reads as a strike-through.
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const overshoot = (cellSize() * 0.42) / length;
    const dx = (b.x - a.x) * overshoot;
    const dy = (b.y - a.y) * overshoot;
    return { x1: a.x - dx, y1: a.y - dy, x2: b.x + dx, y2: b.y + dy };
  };

  const winIndex = (index: number) => props.winningCells.indexOf(index);
  const ended = () => props.result !== null;

  return (
    <div class={`relative w-(--board) shrink-0 ${props.class ?? ""}`}>
      <div
        class="grid gap-[calc(var(--board)*0.03)]"
        style={{ "grid-template-columns": `repeat(${n()}, minmax(0, 1fr))` }}
      >
        <For each={props.cells}>
          {(cell, index) => (
            <div
              class="transition-opacity duration-500"
              classList={{
                "opacity-35": ended() && winIndex(index()) === -1,
                "grayscale-60": props.result === "draw",
                "animate-pop-scale": winIndex(index()) >= 0 && effectsEnabled(),
              }}
              style={
                winIndex(index()) >= 0
                  ? { "animation-delay": `${POP_START_MS + winIndex(index()) * POP_STEP_MS}ms` }
                  : undefined
              }
            >
              <BoardCell
                cell={cell}
                index={index()}
                selected={props.cursor === index()}
                winning={winIndex(index()) >= 0}
                fresh={props.freshCell === index()}
                disabled={ended() || cell.owner !== null}
                color={cell.owner ? props.teamColor(cell.owner) : undefined}
                onClick={() => props.onSelect(index())}
                onMouseEnter={() => props.onHover(index())}
              />
            </div>
          )}
        </For>
      </div>

      <Show when={props.result !== "draw" && line()}>
        {(l) => (
          <svg viewBox="0 0 100 100" class="pointer-events-none absolute inset-0 size-full overflow-visible">
            <g class="drop-shadow-[0_0_1.2cqw_var(--color-yellow-300)]">
              <For
                each={[
                  { color: "white", width: 6.5 },
                  { color: "var(--color-yellow-300)", width: 3.5 },
                ]}
              >
                {(stroke) => (
                  <line
                    {...l()}
                    stroke={stroke.color}
                    stroke-width={stroke.width}
                    stroke-linecap="round"
                    pathLength="1"
                    class="[stroke-dasharray:1]"
                    classList={{ "animate-line-draw [animation-delay:250ms]": effectsEnabled() }}
                  />
                )}
              </For>
            </g>
          </svg>
        )}
      </Show>

      <Show when={props.result === "draw"}>
        <div class="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span
            class="text-9xl text-display whitespace-nowrap text-yellow-300 [--display-shadow:var(--color-yellow-800)]"
            classList={{ "animate-stamp [animation-delay:200ms]": effectsEnabled() }}
          >
            {t("party.ticTacToe.drawStamp")}
          </span>
        </div>
      </Show>
    </div>
  );
}

interface BoardCellProps {
  cell: Cell;
  index: number;
  selected: boolean;
  winning: boolean;
  fresh: boolean;
  disabled: boolean;
  color?: string;
  onClick: () => void;
  onMouseEnter: () => void;
}

function BoardCell(props: BoardCellProps) {
  // A slight, stable tilt per cell makes the marks look hand-placed.
  const tilt = () => ((props.index * 37) % 17) - 8;

  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={() => props.onClick()}
      onMouseEnter={() => props.onMouseEnter()}
      class="relative block aspect-square w-full rounded-[1cqw] shadow-[0_0.6cqw_1.6cqw_rgb(0_0_0/0.35)] transition-[scale,translate] duration-200"
      classList={{
        "cursor-pointer active:scale-95": !props.disabled,
        "z-10 -translate-y-[0.3cqw] scale-106 outline-[0.22cqw] outline-white": props.selected,
        "outline-[0.22cqw] outline-yellow-300": props.winning && !props.selected,
      }}
    >
      <div class="absolute inset-0 overflow-hidden rounded-[1cqw] bg-black">
        <Show when={props.cell.song?.coverUrl}>
          {(url) => (
            <img
              src={url()}
              alt={props.cell.song?.title ?? ""}
              loading="lazy"
              draggable={false}
              class="size-full object-cover"
              classList={{ "opacity-30 grayscale": props.cell.owner !== null }}
            />
          )}
        </Show>
        <Show when={props.color}>
          {(color) => <div class="absolute inset-0 opacity-50" style={{ background: getColorVar(color(), 700) }} />}
        </Show>
      </div>
      <Show when={props.cell.owner}>
        {(owner) => (
          <MarkGlyph
            mark={owner()}
            color={props.color ?? "white"}
            class="absolute inset-[14%]"
            // After the page transition, so the stamp is actually seen.
            classList={{ "animate-stamp [animation-delay:450ms]": props.fresh && effectsEnabled() }}
            style={{ rotate: `${tilt()}deg` }}
          />
        )}
      </Show>
    </button>
  );
}
