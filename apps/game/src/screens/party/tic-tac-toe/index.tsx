import { useNavigate } from "@tanstack/solid-router";
import { createEffect, createMemo, createSignal, For, on, onCleanup, Show, untrack } from "solid-js";

import Confetti from "~/components/fx/confetti";
import TagChip from "~/components/fx/tag-chip";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import SongPlayer from "~/components/song-player";
import Board from "~/components/tic-tac-toe/board";
import MarkGlyph from "~/components/tic-tac-toe/mark-glyph";
import TitleBar from "~/components/title-bar";
import Avatar from "~/components/ui/avatar";
import Button from "~/components/ui/button";
import Panel from "~/components/ui/panel";
import { useNavigation } from "~/hooks/navigation";
import { effectsEnabled } from "~/lib/fx";
import { t } from "~/lib/i18n";
import { buildDuelPlayers, partySongs, slotColor } from "~/lib/party/common";
import { NOT_ALLOWED, STALE, UNAVAILABLE, useRemoteSurface } from "~/lib/remote";
import { playSound } from "~/lib/sound";
import type { User } from "~/lib/types";
import { type LocalSong } from "~/lib/ultrastar/song";
import { getColorVar } from "~/lib/utils/color";
import { getCurrentSinger, getTeam, type Mark, type Team, ticTacToeStore } from "~/stores/party/tic-tac-toe";
import { useRoundActions } from "~/stores/round";
import { settingsStore } from "~/stores/settings";

export default function TicTacToeScreen() {
  const navigate = useNavigate();
  const roundActions = useRoundActions();
  const onBack = () => navigate({ to: "/party/tic-tac-toe/settings" });

  const state = () => ticTacToeStore.state();
  // Start on a re-rolled cell (after a tie), otherwise on the first free one.
  const [cursor, setCursor] = createSignal(
    untrack(
      () =>
        state().lastRerolled ??
        Math.max(
          0,
          state().board.findIndex((cell) => cell.owner === null),
        ),
    ),
  );
  const board = () => state().board;
  const winner = () => state().winner;
  const gridSize = () => state().gridSize;
  const singerMode = () => state().singerMode;
  const turn = () => state().currentTurn;

  // Manual singer-selection phase: the cell being played for, the team currently choosing, and each team's pick.
  const [pickingCell, setPickingCell] = createSignal<number | null>(null);
  const [pickingMark, setPickingMark] = createSignal<Mark>("x");
  const [pickCursor, setPickCursor] = createSignal(0);
  const [pickedSingerX, setPickedSingerX] = createSignal<User | null>(null);

  const pickingTeam = createMemo<Team | null>(() => {
    if (pickingCell() === null) return null;
    return getTeam(state(), pickingMark());
  });

  // The highlighted cell (or the one being played for while picking singers).
  const focusedIndex = () => pickingCell() ?? cursor();
  const focusedCell = () => board()[focusedIndex()];
  // Preview the song on the highlighted empty cell.
  const selectedSong = createMemo<LocalSong | null>(() => {
    if (winner()) return null;
    const cell = focusedCell();
    if (!cell || cell.owner !== null) return null;
    return cell.song;
  });

  const teamColor = (mark: Mark) => slotColor(mark === "x" ? 0 : 1);

  const moveCursor = (action: "up" | "down" | "left" | "right") => {
    const size = gridSize();
    const current = cursor();
    const row = Math.floor(current / size);
    const col = current % size;

    let nextRow = row;
    let nextCol = col;
    if (action === "up") nextRow = (row - 1 + size) % size;
    else if (action === "down") nextRow = (row + 1) % size;
    else if (action === "left") nextCol = (col - 1 + size) % size;
    else if (action === "right") nextCol = (col + 1) % size;

    setCursor(nextRow * size + nextCol);
  };

  // Starts the actual sing-off for a cell with the resolved singers for each team.
  const beginRound = (index: number, singerX: User, singerO: User) => {
    const cell = board()[index];
    if (!cell || !cell.song) return;

    const players = buildDuelPlayers(singerX, singerO, "ticTacToe");
    if (!players) return;

    playSound("confirm");
    ticTacToeStore.setContestedCell(index);
    roundActions.startRound({
      songs: [{ song: cell.song, players, mode: "single", length: "full" }],
      returnTo: "/party/tic-tac-toe",
    });
  };

  // Resolves a team's singer when manual selection isn't needed (single-player team falls back to its only player).
  const onlyPlayer = (team: Team): User | null => (team.players.length === 1 ? (team.players[0] ?? null) : null);

  const startSingOff = (index: number) => {
    if (winner()) return;

    const cell = board()[index];
    if (!cell || cell.owner !== null || !cell.song) return;

    const currentState = state();
    const teamX = getTeam(currentState, "x");
    const teamO = getTeam(currentState, "o");

    if (singerMode() === "manual") {
      // Teams with a single player are auto-resolved; only multi-player teams need a pick.
      const autoX = onlyPlayer(teamX);
      const autoO = onlyPlayer(teamO);

      if (autoX && autoO) {
        beginRound(index, autoX, autoO);
        return;
      }

      playSound("confirm");
      setPickedSingerX(autoX);
      // Start picking with the first team that actually needs a choice.
      setPickingMark(autoX ? "o" : "x");
      setPickCursor(0);
      setPickingCell(index);
      return;
    }

    const singerX = getCurrentSinger(teamX);
    const singerO = getCurrentSinger(teamO);
    if (!singerX || !singerO) return;

    beginRound(index, singerX, singerO);
  };

  const cancelPicking = () => {
    setPickingCell(null);
    setPickedSingerX(null);
    setPickCursor(0);
    setPickingMark("x");
  };

  // Locks in the highlighted player for the team currently choosing, then advances or starts the round.
  const confirmPick = () => {
    const cellIndex = pickingCell();
    const team = pickingTeam();
    if (cellIndex === null || !team) return;

    const player = team.players[pickCursor()];
    if (!player) return;

    if (pickingMark() === "x") {
      setPickedSingerX(player);
      const autoO = onlyPlayer(getTeam(state(), "o"));
      if (autoO) {
        cancelPicking();
        beginRound(cellIndex, player, autoO);
        return;
      }
      // Move on to team O's choice.
      playSound("select");
      setPickingMark("o");
      setPickCursor(0);
      return;
    }

    // Team O just picked: combine with team X's singer and start.
    const singerX = pickedSingerX();
    cancelPicking();
    if (singerX) beginRound(cellIndex, singerX, player);
  };

  // Back while picking undoes team O's choice first (when X chose), then leaves picking.
  const backFromPicking = () => {
    const teamX = getTeam(state(), "x");
    if (pickingMark() === "o" && pickedSingerX() && !onlyPlayer(teamX)) {
      setPickingMark("x");
      setPickCursor(Math.max(0, teamX.players.indexOf(pickedSingerX()!)));
      setPickedSingerX(null);
      return;
    }
    cancelPicking();
  };

  const movePickCursor = (direction: "up" | "down") => {
    const team = pickingTeam();
    if (!team || team.players.length === 0) return;
    const length = team.players.length;
    setPickCursor((prev) => (direction === "down" ? (prev + 1) % length : (prev - 1 + length) % length));
    playSound("select");
  };

  const arrow = (action: "up" | "down" | "left" | "right") => () => {
    moveCursor(action);
    playSound("select");
  };

  // Confirm on the board goes through the footer button (it fires on key up, with press feedback).
  useNavigation(() => ({
    enabled: !winner(),
    // The manual singer pick takes over while it's on.
    actions:
      pickingCell() !== null
        ? {
            back: backFromPicking,
            up: () => movePickCursor("up"),
            down: () => movePickCursor("down"),
            confirm: confirmPick,
          }
        : {
            back: onBack,
            up: arrow("up"),
            down: arrow("down"),
            left: arrow("left"),
            right: arrow("right"),
          },
  }));

  // Phones of the team on turn pick the cell (the cursor on screen follows them), and choose their
  // singer in manual mode. The other team watches.
  const songInfo = (song: LocalSong | null) =>
    song ? { hash: song.hash, title: song.title, artist: song.artist } : null;
  const teamOf = (userId: string) =>
    (["x", "o"] as const).find((mark) => getTeam(state(), mark).players.some((player) => player.id === userId));
  /** Whether `userId` may move on the board now. */
  const onTurn = (userId: string) => !winner() && pickingCell() === null && teamOf(userId) === turn();
  const freeCell = (index: number) => {
    const cell = board()[index];
    return !!cell && cell.owner === null && !!cell.song;
  };

  useRemoteSurface({
    panel: (userId) => {
      const mark = teamOf(userId);
      if (!mark || winner()) return null;

      const cellIndex = pickingCell();
      if (cellIndex !== null) {
        if (pickingMark() !== mark) return { panel: { kind: "ticTacToe.wait", mark, choosing: pickingMark() } };
        return {
          panel: {
            kind: "ticTacToe.singer",
            mark,
            color: teamColor(mark),
            song: songInfo(board()[cellIndex]?.song ?? null),
            players: getTeam(state(), mark).players.map((player) => ({ id: player.id, name: player.username ?? "?" })),
            cursor: pickCursor(),
          },
          attention: true,
        };
      }

      return {
        panel: {
          kind: "ticTacToe.board",
          mark,
          turn: turn(),
          colors: { x: teamColor("x"), o: teamColor("o") },
          size: gridSize(),
          cursor: cursor(),
          cells: board().map((cell) => ({ song: songInfo(cell.song), owner: cell.owner })),
        },
        attention: turn() === mark,
      };
    },
    act: (userId, action) => {
      switch (action.type) {
        case "ticTacToe.cursor":
        case "ticTacToe.pick": {
          if (!onTurn(userId)) return NOT_ALLOWED;
          if (!freeCell(action.cell)) return STALE;
          if (cursor() !== action.cell) {
            setCursor(action.cell);
            playSound("select");
          }
          if (action.type === "ticTacToe.pick") startSingOff(action.cell);
          return { ok: true };
        }
        case "ticTacToe.singerCursor":
        case "ticTacToe.singerPick": {
          if (winner() || pickingCell() === null || teamOf(userId) !== pickingMark()) return NOT_ALLOWED;
          if (!pickingTeam()?.players[action.index]) return STALE;
          if (pickCursor() !== action.index) {
            setPickCursor(action.index);
            playSound("select");
          }
          if (action.type === "ticTacToe.singerPick") confirmPick();
          return { ok: true };
        }
        default:
          return UNAVAILABLE;
      }
    },
  });

  const menuItems: MenuItem[] = [
    {
      type: "button",
      label: t("party.ticTacToe.playAgain"),
      action: () => {
        ticTacToeStore.playAgain(partySongs());
        setCursor(0);
      },
    },
    { type: "button", label: t("party.ticTacToe.exit"), action: () => navigate({ to: "/party" }) },
  ];

  const winningMark = () => {
    const result = winner();
    return result === "x" || result === "o" ? result : null;
  };
  const confettiColors = () => {
    const mark = winningMark();
    if (!mark) return [];
    return [getColorVar(teamColor(mark), 300), getColorVar(teamColor(mark), 500), "var(--color-yellow-300)", "white"];
  };
  // Confetti and a cheer once the win line has been drawn; claps for a draw as its stamp lands.
  const [confetti, setConfetti] = createSignal<number>();
  createEffect(
    on(winner, (result) => {
      if (!result) return;
      const timer =
        result === "draw"
          ? setTimeout(() => playSound("tierC"), 450)
          : setTimeout(() => {
              setConfetti(Date.now());
              playSound("tierA");
            }, 900);
      onCleanup(() => clearTimeout(timer));
    }),
  );

  // In manual mode the singer is only known up front when the team has a single player.
  const knownSinger = (mark: Mark): User | null => {
    const team = getTeam(state(), mark);
    return singerMode() === "manual" ? onlyPlayer(team) : getCurrentSinger(team);
  };
  const matchupMode = (mark: Mark): MatchupMode => {
    if (pickingCell() === null) return knownSinger(mark) ? "show" : "unknown";
    if (pickingMark() === mark) return "pick";
    if (mark === "x") return "show";
    return knownSinger("o") ? "show" : "wait";
  };
  const matchupSinger = (mark: Mark): User | null => {
    if (pickingCell() !== null && mark === "x") return pickedSingerX();
    return knownSinger(mark);
  };

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title={t("party.ticTacToe.title")} onBack={onBack} />}
      footer={
        <div class="flex items-center justify-between gap-8">
          <KeyHints hints={["back", "navigate", "confirm"]} />
          <Show when={!winner() && pickingCell() === null && selectedSong()}>
            <Button
              selected
              size="sm"
              gradient="gradient-party"
              class="w-[16cqw]"
              onClick={() => startSingOff(cursor())}
            >
              {t("party.ticTacToe.start")}
            </Button>
          </Show>
        </div>
      }
      background={
        <Show when={selectedSong()} keyed>
          {(song) => (
            <SongPlayer
              mode="preview"
              volume={settingsStore.getVolume("preview")}
              class="h-full w-full opacity-40"
              playing
              song={song}
            />
          )}
        </Show>
      }
    >
      <Confetti trigger={confetti()} colors={confettiColors()} count={70} class="z-20" />

      <div class="flex h-full items-center justify-center gap-[4cqw] select-none">
        <Board
          class="[--board:min(40cqw,64cqh)]"
          cells={board()}
          gridSize={gridSize()}
          cursor={winner() ? null : (pickingCell() ?? cursor())}
          winningCells={state().winningCells}
          freshCell={state().lastClaimed}
          result={winner()}
          teamColor={teamColor}
          onSelect={(index) => {
            if (pickingCell() !== null) return;
            setCursor(index);
            startSingOff(index);
          }}
          onHover={(index) => pickingCell() === null && setCursor(index)}
        />

        <div class="flex w-[36cqw] flex-col gap-[3cqh]">
          <Show
            when={winner()}
            keyed
            fallback={
              <>
                <TurnBanner
                  mark={turn()}
                  color={teamColor(turn())}
                  subtitle={pickingCell() === null ? t("party.ticTacToe.pickCell") : t("party.ticTacToe.chooseSingers")}
                />
                {/* Fixed height, bottom-aligned: one- and two-line titles never move the stage */}
                <div class="flex h-[8.5cqw] flex-col justify-end">
                  <Show
                    when={selectedSong()}
                    fallback={<span class="text-3xl text-display text-white/50">{t("party.ticTacToe.taken")}</span>}
                  >
                    {(song) => (
                      <>
                        <div class="flex min-w-0 items-center gap-3">
                          <span class="truncate text-2xl font-semibold">{song().artist}</span>
                          <Show when={focusedIndex() === state().lastRerolled}>
                            <TagChip
                              label={t("party.ticTacToe.tieReroll")}
                              class="shrink-0 text-sm"
                              classList={{ "animate-stamp": effectsEnabled() }}
                            />
                          </Show>
                        </div>
                        {/* Short titles big on one line; longer ones a size down, wrapping to two */}
                        <span
                          class="line-clamp-2 pb-[0.1em] leading-[1.1] font-extrabold tracking-tight"
                          classList={{ "text-6xl": song().title.length <= 14, "text-5xl": song().title.length > 14 }}
                        >
                          {song().title}
                        </span>
                      </>
                    )}
                  </Show>
                </div>
                <div class="flex items-stretch gap-4">
                  <For each={["x", "o"] as const}>
                    {(mark, index) => (
                      <>
                        <Show when={index() === 1}>
                          <span class="self-center text-4xl font-black tracking-tight text-yellow-300">VS</span>
                        </Show>
                        <MatchupBox
                          mark={mark}
                          color={teamColor(mark)}
                          team={getTeam(state(), mark)}
                          mode={matchupMode(mark)}
                          singer={matchupSinger(mark)}
                          cursor={pickCursor()}
                          onHover={setPickCursor}
                          onPick={(playerIndex) => {
                            setPickCursor(playerIndex);
                            confirmPick();
                          }}
                        />
                      </>
                    )}
                  </For>
                </div>
              </>
            }
          >
            {(result) => (
              <Show
                when={result !== "draw" && result}
                fallback={
                  <>
                    <span class="text-4xl text-display">{t("party.ticTacToe.noLine")}</span>
                    <span class="text-lg text-white/70">{t("party.ticTacToe.boardFull")}</span>
                  </>
                }
              >
                {(mark) => <WinnerCard mark={mark()} color={teamColor(mark())} team={getTeam(state(), mark())} />}
              </Show>
            )}
          </Show>
          <Show when={winner()}>
            <Menu gradient="gradient-party" class="h-auto!" items={menuItems} onBack={onBack} layer={1} />
          </Show>
        </div>
      </div>
    </Layout>
  );
}

function TurnBanner(props: { mark: Mark; color: string; subtitle: string }) {
  return (
    <Panel
      class="flex items-center gap-4 px-6 py-4"
      surface="overflow-hidden rounded-[1.4cqw] "
      surfaceStyle={{
        background: `linear-gradient(90deg, ${getColorVar(props.color, 500)}, ${getColorVar(props.color, 800)})`,
        "box-shadow": "0 0.15cqw 0 rgb(0 0 0 / 0.3)",
      }}
    >
      <MarkGlyph mark={props.mark} color={props.color} class="size-[5cqw] shrink-0" />
      <div class="flex min-w-0 flex-col">
        <span class="text-5xl leading-none text-display">
          {t("party.ticTacToe.turn", { team: props.mark.toUpperCase() })}
        </span>
        <span class="font-bold text-white/80">{props.subtitle}</span>
      </div>
    </Panel>
  );
}

/** show: the singer · unknown: picked each round (manual mode) · pick: choosing now · wait: the other team is choosing. */
type MatchupMode = "show" | "unknown" | "pick" | "wait";

interface MatchupBoxProps {
  mark: Mark;
  color: string;
  team: Team;
  mode: MatchupMode;
  singer: User | null;
  cursor: number;
  onHover: (index: number) => void;
  onPick: (index: number) => void;
}

/** A team's side of the matchup: who sings, or (while picking) the team's player list. */
function MatchupBox(props: MatchupBoxProps) {
  const heading = () =>
    props.mode === "pick"
      ? t("party.ticTacToe.whoSings")
      : props.mode === "wait"
        ? t("party.ticTacToe.waiting")
        : props.mode === "unknown"
          ? t("party.ticTacToe.pickedEachRound")
          : t("party.ticTacToe.sings");

  return (
    <div
      class="flex min-w-0 flex-1 flex-col gap-3 rounded-[1.2cqw] bg-black/35 p-4 transition-opacity"
      classList={{ "opacity-45": props.mode === "wait" }}
      style={
        props.mode === "pick"
          ? { outline: `0.22cqw solid ${getColorVar(props.color, 400)}`, "outline-offset": "-0.22cqw" }
          : undefined
      }
    >
      <div class="flex items-center gap-2">
        <MarkGlyph mark={props.mark} color={props.color} class="size-[2.2cqw] shrink-0" />
        <span class="truncate text-sm font-bold tracking-[0.15em] text-white/70 uppercase">{heading()}</span>
      </div>
      <Show
        when={props.mode === "pick"}
        fallback={
          <div class="flex min-w-0 flex-col gap-2">
            <Show
              when={props.singer}
              fallback={
                <div class="flex -space-x-2">
                  <For each={props.team.players.slice(0, 4)}>
                    {(player) => <Avatar user={player} class="size-[2.6cqw]" />}
                  </For>
                </div>
              }
            >
              {(singer) => (
                <>
                  <Avatar user={singer()} class="size-[4cqw] shrink-0" />
                  {/* Under the avatar, so names get the box's full width */}
                  <span class="truncate text-2xl font-black tracking-tight">{singer().username}</span>
                </>
              )}
            </Show>
          </div>
        }
      >
        <div class="flex flex-col gap-1.5">
          <For each={props.team.players}>
            {(player, index) => (
              <Panel
                as="button"
                type="button"
                class="flex h-11 cursor-pointer items-center gap-2 px-3 text-left"
                surface="rounded-[0.8cqw] bg-white/8"
                surfaceStyle={
                  props.cursor === index()
                    ? {
                        background: `linear-gradient(90deg, ${getColorVar(props.color, 500)}, ${getColorVar(props.color, 700)})`,
                        "box-shadow": "0 0.15cqw 0 rgb(0 0 0 / 0.3)",
                      }
                    : undefined
                }
                onMouseEnter={() => props.onHover(index())}
                onClick={() => props.onPick(index())}
              >
                <Avatar user={player} class="size-7 shrink-0" />
                <span class="truncate font-bold">{player.username}</span>
              </Panel>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}

function WinnerCard(props: { mark: Mark; color: string; team: Team }) {
  return (
    <Panel
      class="flex flex-col gap-4 px-10 py-6"
      classList={{ "animate-pop-scale [animation-delay:1100ms]": effectsEnabled() }}
      surface="overflow-hidden rounded-[1.6cqw] ring-[0.22cqw] ring-yellow-300 ring-inset"
      surfaceStyle={{
        background: `linear-gradient(160deg, ${getColorVar(props.color, 400)}, ${getColorVar(props.color, 800)})`,
        "box-shadow": "0 0.15cqw 0 rgb(0 0 0 / 0.3)",
      }}
    >
      <div class="flex items-center gap-5">
        <MarkGlyph mark={props.mark} color={props.color} class="size-[7cqw] shrink-0" />
        <div class="flex flex-col">
          <span class="text-6xl leading-none text-display">
            {props.mark === "x" ? t("party.ticTacToe.teamX") : t("party.ticTacToe.teamO")}
          </span>
          <span class="text-6xl leading-none text-display text-yellow-300">{t("party.ticTacToe.wins")}</span>
        </div>
      </div>
      <div class="flex flex-wrap gap-4">
        <For each={props.team.players}>
          {(player) => (
            <div class="flex w-[5cqw] flex-col items-center gap-1">
              <Avatar user={player} class="size-[3.5cqw]" />
              <span class="max-w-full truncate text-sm font-bold">{player.username}</span>
            </div>
          )}
        </For>
      </div>
    </Panel>
  );
}
