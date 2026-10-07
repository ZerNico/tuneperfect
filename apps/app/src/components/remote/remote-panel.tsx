import type { Panel } from "@tuneperfect/webrtc/contracts/game";
import { createEffect, createMemo, createSignal, For, Index, type JSX, Match, on, Show, Switch } from "solid-js";
import IconDice from "~icons/ph/dice-five-fill";
import IconMonitor from "~icons/ph/monitor-bold";
import IconMusicNotes from "~icons/ph/music-notes-fill";

import SongCover from "~/components/song-cover";
import Avatar from "~/components/ui/avatar";
import Button from "~/components/ui/button";
import { useGameConnection } from "~/contexts/game-client";
import { t } from "~/lib/i18n";
import { useRemote } from "~/lib/remote";

/** A colour name from the game (a mic's colour, e.g. "sky"); unknown ones fall back to sky. */
const colorVar = (color: string, shade: 300 | 400 | 500 | 600 | 800) =>
  `var(--color-${color}-${shade}, var(--color-sky-${shade}))`;

type PanelOf<K extends Panel["kind"]> = Extract<Panel, { kind: K }>;

/**
 * A panel's own heading, for the pop-up to use as its title (so it isn't said twice). Panels
 * without one get the pop-up's general title.
 */
export function panelTitle(panel: Panel): string | undefined {
  switch (panel.kind) {
    case "ticTacToe.board":
      return panel.turn === panel.mark
        ? t("remote.ticTacToe.yourTurn")
        : t("remote.ticTacToe.theirTurn", { mark: markLabel(panel.turn) });
    case "ticTacToe.singer":
      return t("remote.ticTacToe.chooseSinger");
    default:
      return undefined;
  }
}

/**
 * What you can do in the game right now, as the game describes it. Shared by the controller and the
 * pop-up. `titled={false}` leaves out the heading when the pop-up shows it as its title.
 */
export default function RemotePanel(props: { panel: Panel; titled?: boolean }) {
  // The game may be newer than this app and send something it doesn't know yet.
  const panel = () => props.panel as Panel | { kind: string };
  const is = <K extends Panel["kind"]>(kind: K) => (panel().kind === kind ? (panel() as PanelOf<K>) : undefined);

  return (
    <Switch fallback={<Notice title={t("remote.unknown")}>{t("remote.unknownHint")}</Notice>}>
      <Match when={is("versus")}>{(panel) => <VersusPanel panel={panel()} />}</Match>
      <Match when={is("versus.watch")}>{(panel) => <VersusWatchPanel panel={panel()} />}</Match>
      <Match when={is("ticTacToe.board")}>
        {(panel) => <BoardPanel panel={panel()} titled={props.titled !== false} />}
      </Match>
      <Match when={is("ticTacToe.singer")}>
        {(panel) => <SingerPanel panel={panel()} titled={props.titled !== false} />}
      </Match>
      <Match when={is("ticTacToe.wait")}>
        {(panel) => (
          <Notice title={t("remote.ticTacToe.waiting", { mark: markLabel(panel().choosing) })}>
            {t("remote.ticTacToe.waitingHint")}
          </Notice>
        )}
      </Match>
    </Switch>
  );
}

/** Nothing to do here, with a reason. */
export function Notice(props: { title: string; children?: JSX.Element }) {
  return (
    <div class="flex flex-col items-center gap-2 rounded-[16px] bg-white/7 px-5 py-8 text-center">
      <IconMonitor class="mb-1 text-3xl text-white/50" />
      <span class="text-lg font-bold">{props.title}</span>
      <Show when={props.children}>
        <span class="text-[15px] text-white/60">{props.children}</span>
      </Show>
    </div>
  );
}

/**
 * A song with its cover. Always the same height: while there's none (the versus reel is spinning, a
 * taken cell) it shows `empty` instead, so the buttons below don't jump.
 */
function SongLine(props: { song: { hash: string; title: string; artist: string } | null; empty?: string }) {
  const client = useGameConnection();
  return (
    <div class="flex h-12 min-w-0 items-center gap-3">
      <Show
        when={props.song}
        fallback={
          <>
            <span class="flex size-12 shrink-0 items-center justify-center rounded-[8px] bg-white/8" aria-hidden="true">
              <IconMusicNotes class="text-white/25" />
            </span>
            <span class="truncate text-white/50">{props.empty}</span>
          </>
        }
      >
        {(song) => (
          <>
            <SongCover hash={song().hash} client={client()} class="size-12 rounded-[8px]" />
            <div class="flex min-w-0 flex-col">
              <span class="truncate font-bold">{song().title}</span>
              <span class="truncate text-sm text-white/60">{song().artist}</span>
            </div>
          </>
        )}
      </Show>
    </div>
  );
}

/** More jokers than this show as a count instead of dice, like on the game. */
const MAX_DICE = 6;

/**
 * Your duel: a calm card with a hint of your mic's colour. Mic and opponent on top, the song, and
 * your jokers as dice like the game shows them, with the button to spend one.
 */
function VersusPanel(props: { panel: PanelOf<"versus"> }) {
  const remote = useRemote();

  return (
    <div
      class="flex flex-col gap-4 rounded-[18px] p-4"
      style={{
        background: `linear-gradient(160deg, color-mix(in oklch, ${colorVar(props.panel.color, 500)} 22%, transparent), rgb(255 255 255 / 0.06))`,
      }}
    >
      <div class="flex items-center justify-between gap-3">
        <span
          class="shrink-0 rounded-[7px] px-2 py-1 text-xs font-black tracking-[0.08em] uppercase"
          style={{ "background-color": colorVar(props.panel.color, 500) }}
        >
          {t("remote.versus.mic", { number: props.panel.slot + 1 })}
        </span>
        <span class="flex min-w-0 items-center gap-2 text-sm font-bold text-white">
          <span class="truncate">{t("remote.versus.against", { name: props.panel.opponent.name })}</span>
          <Avatar user={{ username: props.panel.opponent.name, image: props.panel.opponent.image }} size="sm" />
        </span>
      </div>

      <SongLine song={props.panel.song} empty={t("remote.versus.spinning")} />

      <div
        class="flex h-6 items-center justify-between gap-3"
        aria-label={t("remote.versus.jokers", { count: props.panel.jokers, max: props.panel.maxJokers })}
      >
        <span class="text-sm font-bold text-white/60">{t("remote.versus.jokersLabel")}</span>
        <Show
          when={props.panel.maxJokers <= MAX_DICE}
          fallback={
            <span class="flex items-center gap-1.5 font-black" classList={{ "opacity-40": props.panel.jokers === 0 }}>
              <IconDice class="text-2xl" />×{props.panel.jokers}
            </span>
          }
        >
          <span class="flex gap-1">
            <For each={Array.from({ length: props.panel.maxJokers }, (_, i) => i)}>
              {(i) => (
                <IconDice
                  class="text-2xl transition-[color,scale] duration-300"
                  classList={{
                    "text-white": i < props.panel.jokers,
                    "scale-75 text-white/20": i >= props.panel.jokers,
                  }}
                />
              )}
            </For>
          </span>
        </Show>
      </div>

      <Button
        intent="gradient"
        class="w-full"
        disabled={!props.panel.canReroll}
        onClick={() => remote.act({ type: "versus.reroll" })}
      >
        {t("remote.versus.useJoker")}
      </Button>
    </div>
  );
}

function VersusWatchPanel(props: { panel: PanelOf<"versus.watch"> }) {
  return (
    <div class="flex flex-col gap-3 rounded-[16px] bg-white/7 p-4">
      <span class="text-xl font-black">
        {t("remote.versus.watch", { a: props.panel.players[0], b: props.panel.players[1] })}
      </span>
      <SongLine song={props.panel.song} empty={t("remote.versus.spinning")} />
    </div>
  );
}

const markLabel = (mark: "x" | "o") => mark.toUpperCase();

/**
 * The game's cursor, or the one just tapped until the game's answer arrives: confirming right
 * after a tap picks what was tapped, not what the game showed a moment ago.
 */
/**
 * The highlighted entry: the one just tapped, until the game's cursor follows. If the game turns the
 * tap down, its cursor stays where it was, so the highlight goes back there.
 */
function createCursor(fromGame: () => number, act: (index: number) => Promise<boolean>) {
  const [tapped, setTapped] = createSignal<number | null>(null);
  createEffect(on(fromGame, () => setTapped(null), { defer: true }));
  const cursor = () => tapped() ?? fromGame();
  const tap = async (index: number) => {
    setTapped(index);
    if (!(await act(index)) && tapped() === index) setTapped(null);
  };
  return [cursor, tap] as const;
}

function BoardPanel(props: { panel: PanelOf<"ticTacToe.board">; titled: boolean }) {
  const remote = useRemote();
  const client = useGameConnection();
  const yourTurn = () => props.panel.turn === props.panel.mark;
  const [cursor, tapCursor] = createCursor(
    () => props.panel.cursor,
    (cell) => remote.act({ type: "ticTacToe.cursor", cell }),
  );
  const selected = createMemo(() => {
    const cell = props.panel.cells[cursor()];
    return cell && cell.owner === null ? cell.song : null;
  });

  return (
    <div class="flex flex-col gap-4">
      <Show when={props.titled}>
        <span class="text-xl font-black">{panelTitle(props.panel)}</span>
      </Show>

      <div class="grid gap-1.5" style={{ "grid-template-columns": `repeat(${props.panel.size}, minmax(0, 1fr))` }}>
        <Index each={props.panel.cells}>
          {(cell, index) => (
            <button
              type="button"
              class="relative aspect-square overflow-hidden rounded-[10px] bg-white/8 transition-[scale,translate] duration-200 active:scale-95 disabled:active:scale-100"
              // Like the game's board: the selected cell lifts a little with a white outline around it.
              classList={{
                "z-10 -translate-y-0.5 scale-105 outline-3 outline-white":
                  yourTurn() && index === cursor() && cell().owner === null,
              }}
              disabled={!yourTurn() || cell().owner !== null}
              aria-label={cell().song?.title ?? t("remote.ticTacToe.taken")}
              aria-pressed={yourTurn() && cell().owner === null ? index === cursor() : undefined}
              onClick={() => void tapCursor(index)}
            >
              <Show when={cell().song}>
                {(song) => <SongCover hash={song().hash} client={client()} class="absolute inset-0 size-full" />}
              </Show>
              <Show when={cell().owner}>
                {(owner) => (
                  <span
                    class="absolute inset-0 flex items-center justify-center text-4xl font-black"
                    style={{ "background-color": colorVar(props.panel.colors[owner()], 600) }}
                  >
                    {markLabel(owner())}
                  </span>
                )}
              </Show>
            </button>
          )}
        </Index>
      </div>

      <Show when={yourTurn()}>
        <SongLine song={selected()} empty={t("remote.ticTacToe.taken")} />
        <Button
          intent="gradient"
          class="w-full"
          disabled={!selected()}
          onClick={() => remote.act({ type: "ticTacToe.pick", cell: cursor() })}
        >
          {t("remote.ticTacToe.pick")}
        </Button>
      </Show>
    </div>
  );
}

function SingerPanel(props: { panel: PanelOf<"ticTacToe.singer">; titled: boolean }) {
  const remote = useRemote();
  const [cursor, tapCursor] = createCursor(
    () => props.panel.cursor,
    (index) => remote.act({ type: "ticTacToe.singerCursor", index }),
  );
  const chosen = () => props.panel.players[cursor()];

  return (
    <div class="flex flex-col gap-4">
      <Show when={props.titled}>
        <span class="text-xl font-black">{panelTitle(props.panel)}</span>
      </Show>
      <SongLine song={props.panel.song} />
      <div class="flex flex-col gap-1.5">
        <For each={props.panel.players}>
          {(player, index) => (
            <button
              type="button"
              class="flex min-h-12 cursor-pointer items-center rounded-[12px] px-4 text-start font-bold transition-colors"
              classList={{ "bg-white/8 hover:bg-white/12": index() !== cursor() }}
              style={index() === cursor() ? { "background-color": colorVar(props.panel.color, 600) } : undefined}
              aria-pressed={index() === cursor()}
              onClick={() => void tapCursor(index())}
            >
              {player.name}
            </button>
          )}
        </For>
      </div>
      <Button
        intent="gradient"
        class="w-full"
        disabled={!chosen()}
        onClick={() => remote.act({ type: "ticTacToe.singerPick", index: cursor() })}
      >
        {t("remote.ticTacToe.confirmSinger", { name: chosen()?.name ?? "" })}
      </Button>
    </div>
  );
}
