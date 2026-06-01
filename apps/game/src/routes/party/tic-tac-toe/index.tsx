import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { batch, createMemo, createSignal, For, Show } from "solid-js";
import IconCircle from "~icons/lucide/circle";
import IconMicVocal from "~icons/lucide/mic-vocal";
import IconTrophy from "~icons/lucide/trophy";
import IconX from "~icons/lucide/x";

import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import SongPlayer from "~/components/song-player";
import TitleBar from "~/components/title-bar";
import Avatar from "~/components/ui/avatar";
import { useNavigation } from "~/hooks/navigation";
import { t } from "~/lib/i18n";
import type { User } from "~/lib/types";
import { isLocalSong, type LocalSong } from "~/lib/ultrastar/song";
import { getColorVar } from "~/lib/utils/color";
import { getMaxScore, getRelativeScore } from "~/lib/utils/score";
import { getCurrentSinger, getTeam, type Mark, type Team, ticTacToeStore } from "~/stores/party/tic-tac-toe";
import { type PlayerSelection, roundStore, useRoundActions } from "~/stores/round";
import { settingsStore } from "~/stores/settings";
import { songsStore } from "~/stores/songs";

export const Route = createFileRoute("/party/tic-tac-toe/")({
  component: TicTacToeComponent,
  loader: async () => {
    if (roundStore.settings()?.returnTo !== "/party/tic-tac-toe") return;

    const lastResult = roundStore.results().at(-1);
    if (!lastResult) return;

    const state = ticTacToeStore.state();
    const contestedCell = state.contestedCell;
    if (contestedCell === null) return;

    const singleVoiceSongs = songsStore.songs().filter((s) => s.voices.length === 1);

    // The contested song could not produce a valid outcome (e.g. it failed to play, or the round
    // was aborted) -> treat it as a draw and swap in a new song on the same cell.
    const rerollAndReset = () => {
      batch(() => {
        ticTacToeStore.rerollCell(contestedCell, singleVoiceSongs);
        roundStore.reset();
      });
    };

    const song = lastResult.song.song;
    if (!isLocalSong(song)) {
      rerollAndReset();
      return;
    }

    const voice = song.voices[0];
    const players = lastResult.song.players;
    const scores = lastResult.scores;

    if (scores.length !== 2 || !voice || players.length !== 2) {
      console.warn("Tic Tac Toe: conditions not met for processing round result", { voice, players, scores });
      rerollAndReset();
      return;
    }

    const totalScores = scores.map((score) => {
      const maxScore = getMaxScore(voice);
      const relativeScore = getRelativeScore(score, maxScore);
      return Math.floor(relativeScore.normal + relativeScore.golden + relativeScore.bonus);
    });

    const xScore = totalScores[0] ?? 0;
    const oScore = totalScores[1] ?? 0;

    batch(() => {
      // A tie is a draw: re-roll the song on the same cell and replay rather than awarding it.
      const isDraw = xScore === oScore;
      if (isDraw) {
        ticTacToeStore.rerollCell(contestedCell, singleVoiceSongs);
      } else {
        const winnerMark: Mark = xScore > oScore ? "x" : "o";
        ticTacToeStore.claimCell(contestedCell, winnerMark);
        if (!ticTacToeStore.state().winner) {
          ticTacToeStore.nextTurn();
        }
      }
      roundStore.reset();
    });
  },
});

function TicTacToeComponent() {
  const navigate = useNavigate();
  const roundActions = useRoundActions();
  const onBack = () => navigate({ to: "/party/tic-tac-toe/settings" });

  const [cursor, setCursor] = createSignal(0);

  const state = () => ticTacToeStore.state();
  const board = () => state().board;
  const winner = () => state().winner;
  const gridSize = () => state().gridSize;
  const singerMode = () => state().singerMode;

  // Manual singer-selection phase: the cell being played for, the team currently choosing, and each team's pick.
  const [pickingCell, setPickingCell] = createSignal<number | null>(null);
  const [pickingMark, setPickingMark] = createSignal<Mark>("x");
  const [pickCursor, setPickCursor] = createSignal(0);
  const [pickedSingerX, setPickedSingerX] = createSignal<User | null>(null);

  const pickingTeam = createMemo<Team | null>(() => {
    if (pickingCell() === null) return null;
    return getTeam(state(), pickingMark());
  });

  // Preview the song on the currently highlighted (empty) cell, like the selected song in versus mode.
  const selectedSong = createMemo<LocalSong | null>(() => {
    if (winner()) return null;
    const cell = board()[cursor()];
    if (!cell || cell.owner !== null) return null;
    return cell.song;
  });

  const teamColor = (mark: Mark) => {
    const index = mark === "x" ? 0 : 1;
    return settingsStore.microphones()[index]?.color ?? (mark === "x" ? "blue" : "red");
  };

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

    const micX = settingsStore.microphones()[0];
    const micO = settingsStore.microphones()[1];
    if (!micX || !micO) return;

    const players: PlayerSelection[] = [
      { player: singerX, voice: 0, microphone: micX },
      { player: singerO, voice: 0, microphone: micO },
    ];

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

      setPickedSingerX(autoX);
      // Start picking with the first team that actually needs a choice.
      const firstMark: Mark = autoX ? "o" : "x";
      setPickingMark(firstMark);
      setPickCursor(0);
      setPickingCell(index);
      return;
    }

    const singerX = getCurrentSinger(teamX);
    const singerO = getCurrentSinger(teamO);
    if (!singerX || !singerO) return;

    beginRound(index, singerX, singerO);
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
      const teamO = getTeam(state(), "o");
      const autoO = onlyPlayer(teamO);
      if (autoO) {
        cancelPicking();
        beginRound(cellIndex, player, autoO);
        return;
      }
      // Move on to team O's choice.
      setPickingMark("o");
      setPickCursor(0);
      return;
    }

    // Team O just picked: combine with team X's singer and start.
    const singerX = pickedSingerX();
    if (!singerX) {
      cancelPicking();
      return;
    }
    cancelPicking();
    beginRound(cellIndex, singerX, player);
  };

  const cancelPicking = () => {
    setPickingCell(null);
    setPickedSingerX(null);
    setPickCursor(0);
    setPickingMark("x");
  };

  const movePickCursor = (direction: "up" | "down") => {
    const team = pickingTeam();
    if (!team || team.players.length === 0) return;
    const length = team.players.length;
    setPickCursor((prev) => (direction === "down" ? (prev + 1) % length : (prev - 1 + length) % length));
  };

  useNavigation(() => ({
    enabled: !winner(),
    onKeydown(event) {
      // Manual singer-pick phase takes over navigation while active.
      if (pickingCell() !== null) {
        if (event.action === "back") {
          cancelPicking();
        } else if (event.action === "up" || event.action === "down") {
          movePickCursor(event.action);
        } else if (event.action === "confirm") {
          confirmPick();
        }
        return;
      }

      if (event.action === "back") {
        onBack();
      } else if (
        event.action === "up" ||
        event.action === "down" ||
        event.action === "left" ||
        event.action === "right"
      ) {
        moveCursor(event.action);
      } else if (event.action === "confirm") {
        startSingOff(cursor());
      }
    },
  }));

  const menuItems: MenuItem[] = [
    {
      type: "button",
      label: t("party.ticTacToe.restart"),
      action: onBack,
    },
    {
      type: "button",
      label: t("party.ticTacToe.exit"),
      action: () => navigate({ to: "/party" }),
    },
  ];

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title={t("party.ticTacToe.title")} onBack={onBack} />}
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
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
      <div class="grid h-full w-full grid-cols-[1fr_2fr_1fr] items-center gap-8 px-8">
        <TeamPanel mark="x" colorName={teamColor("x")} active={state().currentTurn === "x" && !winner()} />

        <Show
          when={!winner()}
          fallback={
            <TicTacToeEndScreen
              winner={winner()}
              colorName={winner() === "x" || winner() === "o" ? teamColor(winner() as Mark) : "white"}
              menuItems={menuItems}
              onBack={onBack}
            />
          }
        >
          <Show
            when={pickingCell() === null}
            fallback={
              <SingerPicker
                team={pickingTeam()}
                colorName={teamColor(pickingMark())}
                cursor={pickCursor()}
                onHover={(index) => setPickCursor(index)}
                onSelect={(index) => {
                  setPickCursor(index);
                  confirmPick();
                }}
              />
            }
          >
            <div class="mx-auto flex w-full max-w-[70vh] flex-col gap-4">
              <div
                class="grid aspect-square w-full gap-2"
                style={{ "grid-template-columns": `repeat(${gridSize()}, minmax(0, 1fr))` }}
              >
                <For each={board()}>
                  {(cell, index) => (
                    <BoardCell
                      cell={cell}
                      selected={cursor() === index()}
                      winning={state().winningCells.includes(index())}
                      colorName={cell.owner ? teamColor(cell.owner) : undefined}
                      onClick={() => {
                        setCursor(index());
                        startSingOff(index());
                      }}
                      onMouseEnter={() => setCursor(index())}
                    />
                  )}
                </For>
              </div>

              {/* Title / artist of the currently highlighted song, like the selected song in versus. */}
              <div class="flex h-12 flex-col items-center justify-center text-center">
                <Show when={selectedSong()}>
                  {(song) => (
                    <>
                      <p class="truncate font-bold text-white">{song().title}</p>
                      <p class="truncate text-sm text-white/70">{song().artist}</p>
                    </>
                  )}
                </Show>
              </div>
            </div>
          </Show>
        </Show>

        <TeamPanel mark="o" colorName={teamColor("o")} active={state().currentTurn === "o" && !winner()} />
      </div>
    </Layout>
  );
}

interface SingerPickerProps {
  team: Team | null;
  colorName: string;
  cursor: number;
  onHover: (index: number) => void;
  onSelect: (index: number) => void;
}

function SingerPicker(props: SingerPickerProps) {
  return (
    <div class="mx-auto flex w-full max-w-[70vh] flex-col items-center justify-center gap-6">
      <div class="flex items-center gap-3 text-white">
        <Show when={props.team?.mark === "x"} fallback={<IconCircle class="text-3xl" />}>
          <IconX class="text-3xl" />
        </Show>
        <span class="text-2xl font-bold">{t("party.ticTacToe.chooseSinger")}</span>
      </div>

      <div class="flex w-full max-w-md flex-col gap-2">
        <For each={props.team?.players ?? []}>
          {(player, index) => (
            <button
              type="button"
              class="flex cursor-pointer items-center gap-3 rounded-lg px-4 py-3 text-white transition-all"
              classList={{ "ring-2 ring-white": props.cursor === index() }}
              style={{
                background:
                  props.cursor === index()
                    ? `linear-gradient(90deg, ${getColorVar(props.colorName, 600)}, ${getColorVar(props.colorName, 500)})`
                    : "rgba(255, 255, 255, 0.1)",
              }}
              onClick={() => props.onSelect(index())}
              onMouseEnter={() => props.onHover(index())}
            >
              <Avatar user={player} class="h-9 w-9 shrink-0" />
              <span class="truncate font-bold">{player.username}</span>
            </button>
          )}
        </For>
      </div>
    </div>
  );
}

interface TeamPanelProps {
  mark: Mark;
  colorName: string;
  active: boolean;
}

function TeamPanel(props: TeamPanelProps) {
  const team = createMemo(() => getTeam(ticTacToeStore.state(), props.mark));
  // The rotation-based singer only applies in random mode; in manual mode the singer is chosen per round.
  const singer = createMemo(() => (ticTacToeStore.state().singerMode === "random" ? getCurrentSinger(team()) : null));

  return (
    <div
      class="flex flex-col gap-4 rounded-xl p-5 text-white shadow-lg transition-all"
      classList={{
        "ring-4 ring-white": props.active,
        "opacity-60": !props.active,
      }}
      style={{
        background: `linear-gradient(180deg, ${getColorVar(props.colorName, 600)}, ${getColorVar(props.colorName, 800)})`,
      }}
    >
      <div class="flex items-center gap-3">
        <Show when={props.mark === "x"} fallback={<IconCircle class="text-3xl" />}>
          <IconX class="text-3xl" />
        </Show>
        <span class="text-2xl font-bold">{t("party.ticTacToe.team")}</span>
      </div>

      <Show when={props.active}>
        <span class="text-sm opacity-80">{t("party.ticTacToe.yourTurn")}</span>
      </Show>

      <div class="flex flex-col gap-2">
        <For each={team().players}>
          {(player) => (
            <div
              class="flex items-center gap-2 rounded-lg px-2 py-1"
              classList={{ "bg-white/20": singer()?.id === player.id && props.active }}
            >
              <Avatar user={player} class="h-7 w-7" />
              <span class="truncate text-sm">{player.username}</span>
              <Show when={singer()?.id === player.id}>
                <IconMicVocal class="ml-auto text-sm opacity-70" />
              </Show>
            </div>
          )}
        </For>
      </div>
    </div>
  );
}

interface BoardCellProps {
  cell: { song: LocalSong | null; owner: Mark | null };
  selected: boolean;
  winning: boolean;
  colorName?: string;
  onClick: () => void;
  onMouseEnter: () => void;
}

function BoardCell(props: BoardCellProps) {
  return (
    <button
      type="button"
      onClick={() => props.onClick()}
      onMouseEnter={() => props.onMouseEnter()}
      disabled={props.cell.owner !== null}
      class="relative aspect-square w-full cursor-pointer overflow-hidden rounded-lg bg-black/30 shadow-lg transition-all duration-200"
      classList={{
        "z-10 scale-105 ring-4 ring-white": props.selected,
        "cursor-default": props.cell.owner !== null,
        "ring-4 ring-yellow-400": props.winning,
      }}
    >
      <Show when={props.cell.song}>
        {(song) => (
          <img
            loading="lazy"
            src={song().coverUrl ?? ""}
            alt={song().title}
            class="h-full w-full object-cover"
            classList={{ "opacity-40": props.cell.owner !== null }}
          />
        )}
      </Show>

      <Show when={props.cell.owner}>
        {(owner) => (
          <div
            class="absolute inset-0 flex items-center justify-center text-[min(7vh,3rem)]"
            style={{ color: getColorVar(props.colorName ?? "white", 300) }}
          >
            <Show when={owner() === "x"} fallback={<IconCircle class="drop-shadow-lg" />}>
              <IconX class="drop-shadow-lg" />
            </Show>
          </div>
        )}
      </Show>
    </button>
  );
}

interface TicTacToeEndScreenProps {
  winner: Mark | "draw" | null;
  colorName: string;
  menuItems: MenuItem[];
  onBack: () => void;
}

function TicTacToeEndScreen(props: TicTacToeEndScreenProps) {
  return (
    <div class="flex h-full w-full flex-col items-center justify-center">
      <div class="flex flex-1 flex-col items-center justify-center gap-4">
        <IconTrophy class="text-6xl" />
        <p class="gradient-party bg-linear-to-b bg-clip-text text-center text-5xl font-bold text-transparent">
          <Show when={props.winner !== "draw"} fallback={t("party.ticTacToe.draw")}>
            {props.winner === "x" ? t("party.ticTacToe.teamX") : t("party.ticTacToe.teamO")} {t("party.ticTacToe.wins")}
            !
          </Show>
        </p>
      </div>
      <Menu gradient="gradient-party" class="h-auto!" items={props.menuItems} onBack={props.onBack} layer={1} />
    </div>
  );
}
