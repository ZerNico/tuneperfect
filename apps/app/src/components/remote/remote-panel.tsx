import type { Panel } from "@tuneperfect/webrtc/contracts/game";
import { createMemo, For, Index, type JSX, Match, Show, Switch } from "solid-js";
import IconDice from "~icons/ph/dice-five-fill";
import IconMonitor from "~icons/ph/monitor-bold";

import SongCover from "~/components/song-cover";
import Button from "~/components/ui/button";
import { useGameConnection } from "~/contexts/game-client";
import { t } from "~/lib/i18n";
import { useRemote } from "~/lib/remote";

/** A colour name from the game (a mic's colour, e.g. "sky"); unknown ones fall back to sky. */
const colorVar = (color: string, shade: 300 | 400 | 600 | 800) =>
  `var(--color-${color}-${shade}, var(--color-sky-${shade}))`;

type PanelOf<K extends Panel["kind"]> = Extract<Panel, { kind: K }>;

/** What you can do in the game right now, as the game describes it. Shared by the controller and the pop-up. */
export default function RemotePanel(props: { panel: Panel }) {
  // The game may be newer than this app and send something it doesn't know yet.
  const panel = () => props.panel as Panel | { kind: string };
  const is = <K extends Panel["kind"]>(kind: K) => (panel().kind === kind ? (panel() as PanelOf<K>) : undefined);

  return (
    <Switch fallback={<Notice title={t("remote.unknown")}>{t("remote.unknownHint")}</Notice>}>
      <Match when={is("versus")}>{(panel) => <VersusPanel panel={panel()} />}</Match>
      <Match when={is("versus.watch")}>{(panel) => <VersusWatchPanel panel={panel()} />}</Match>
      <Match when={is("ticTacToe.board")}>{(panel) => <BoardPanel panel={panel()} />}</Match>
      <Match when={is("ticTacToe.singer")}>{(panel) => <SingerPanel panel={panel()} />}</Match>
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

function SongLine(props: { song: { hash: string; title: string; artist: string } | null }) {
  const client = useGameConnection();
  return (
    <Show when={props.song}>
      {(song) => (
        <div class="flex min-w-0 items-center gap-3">
          <SongCover hash={song().hash} client={client()} class="size-12 rounded-[8px]" />
          <div class="flex min-w-0 flex-col">
            <span class="truncate font-bold">{song().title}</span>
            <span class="truncate text-sm text-white/60">{song().artist}</span>
          </div>
        </div>
      )}
    </Show>
  );
}

function VersusPanel(props: { panel: PanelOf<"versus"> }) {
  const remote = useRemote();

  return (
    <div class="flex flex-col gap-4">
      <div
        class="flex flex-col gap-3 rounded-[16px] p-4 shadow-crisp"
        style={{
          background: `linear-gradient(160deg, ${colorVar(props.panel.color, 400)}, ${colorVar(props.panel.color, 800)})`,
        }}
      >
        <div class="flex items-baseline justify-between gap-3">
          <span class="text-2xl font-black">{t("remote.versus.mic", { number: props.panel.slot + 1 })}</span>
          <span class="truncate text-[15px] font-bold text-white/80">
            {t("remote.versus.against", { name: props.panel.opponent.name })}
          </span>
        </div>
        <SongLine song={props.panel.song} />
      </div>

      <div class="flex items-center justify-between gap-3">
        <span class="flex items-center gap-1.5 text-lg font-black">
          <IconDice class="text-2xl" />
          {t("remote.versus.jokers", { count: props.panel.jokers, max: props.panel.maxJokers })}
        </span>
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
      <SongLine song={props.panel.song} />
    </div>
  );
}

const markLabel = (mark: "x" | "o") => mark.toUpperCase();

function BoardPanel(props: { panel: PanelOf<"ticTacToe.board"> }) {
  const remote = useRemote();
  const client = useGameConnection();
  const yourTurn = () => props.panel.turn === props.panel.mark;
  const selected = createMemo(() => {
    const cell = props.panel.cells[props.panel.cursor];
    return cell && cell.owner === null ? cell.song : null;
  });

  return (
    <div class="flex flex-col gap-4">
      <span class="text-xl font-black">
        <Show when={yourTurn()} fallback={t("remote.ticTacToe.theirTurn", { mark: markLabel(props.panel.turn) })}>
          {t("remote.ticTacToe.yourTurn")}
        </Show>
      </span>

      <div class="grid gap-1.5" style={{ "grid-template-columns": `repeat(${props.panel.size}, minmax(0, 1fr))` }}>
        <Index each={props.panel.cells}>
          {(cell, index) => (
            <button
              type="button"
              class="relative aspect-square overflow-hidden rounded-[10px] bg-white/8 transition-transform active:scale-95 disabled:active:scale-100"
              classList={{
                "ring-3 ring-white ring-inset": yourTurn() && index === props.panel.cursor && cell().owner === null,
              }}
              disabled={!yourTurn() || cell().owner !== null}
              aria-label={cell().song?.title ?? t("remote.ticTacToe.taken")}
              onClick={() => remote.act({ type: "ticTacToe.cursor", cell: index })}
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
        <SongLine song={selected()} />
        <Button
          intent="gradient"
          class="w-full"
          disabled={!selected()}
          onClick={() => remote.act({ type: "ticTacToe.pick", cell: props.panel.cursor })}
        >
          {t("remote.ticTacToe.pick")}
        </Button>
      </Show>
    </div>
  );
}

function SingerPanel(props: { panel: PanelOf<"ticTacToe.singer"> }) {
  const remote = useRemote();
  const chosen = () => props.panel.players[props.panel.cursor];

  return (
    <div class="flex flex-col gap-4">
      <span class="text-xl font-black">{t("remote.ticTacToe.chooseSinger")}</span>
      <SongLine song={props.panel.song} />
      <div class="flex flex-col gap-1.5">
        <For each={props.panel.players}>
          {(player, index) => (
            <button
              type="button"
              class="flex min-h-12 cursor-pointer items-center rounded-[12px] px-4 text-start font-bold transition-colors"
              classList={{ "bg-white/8 hover:bg-white/12": index() !== props.panel.cursor }}
              style={
                index() === props.panel.cursor ? { "background-color": colorVar(props.panel.color, 600) } : undefined
              }
              onClick={() => remote.act({ type: "ticTacToe.singerCursor", index: index() })}
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
        onClick={() => remote.act({ type: "ticTacToe.singerPick", index: props.panel.cursor })}
      >
        {t("remote.ticTacToe.confirmSinger", { name: chosen()?.name ?? "" })}
      </Button>
    </div>
  );
}
