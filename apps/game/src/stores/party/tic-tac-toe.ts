import { createSignal } from "solid-js";

import type { User } from "~/lib/types";
import type { LocalSong } from "~/lib/ultrastar/song";

export type Mark = "x" | "o";

export type SingerMode = "random" | "manual";

export interface Team {
  mark: Mark;
  players: User[];
  /** Shuffled player indices defining the singing order for the current cycle. */
  order: number[];
  /** Position within `order` of the player who sings next. */
  rotationIndex: number;
}

export interface Cell {
  song: LocalSong | null;
  owner: Mark | null;
}

export interface State {
  teams: [Team, Team];
  board: Cell[];
  gridSize: number;
  winLength: number;
  singerMode: SingerMode;
  currentTurn: Mark;
  contestedCell: number | null;
  winner: Mark | "draw" | null;
  winningCells: number[];
  playing: boolean;
}

export const GRID_SIZES = [3, 4, 5] as const;
export const DEFAULT_GRID_SIZE = 3;

/** Default number of cells in a row needed to win: full grid size, but at least 3. */
export function defaultWinLength(gridSize: number): number {
  return Math.max(3, gridSize);
}

/** Valid win-length options for a grid size (3 up to the grid size). */
export function winLengthOptions(gridSize: number): number[] {
  const options: number[] = [];
  for (let length = 3; length <= gridSize; length++) {
    options.push(length);
  }
  return options.length > 0 ? options : [gridSize];
}

/**
 * Generates all winning lines (as arrays of cell indices) for a grid of `gridSize`
 * where `winLength` marks in a row (horizontal, vertical, or diagonal) wins.
 */
export function generateWinningLines(gridSize: number, winLength: number): number[][] {
  const lines: number[][] = [];
  const index = (row: number, col: number) => row * gridSize + col;

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      // Horizontal
      if (col + winLength <= gridSize) {
        lines.push(Array.from({ length: winLength }, (_, i) => index(row, col + i)));
      }
      // Vertical
      if (row + winLength <= gridSize) {
        lines.push(Array.from({ length: winLength }, (_, i) => index(row + i, col)));
      }
      // Diagonal down-right
      if (row + winLength <= gridSize && col + winLength <= gridSize) {
        lines.push(Array.from({ length: winLength }, (_, i) => index(row + i, col + i)));
      }
      // Diagonal down-left
      if (row + winLength <= gridSize && col - winLength + 1 >= 0) {
        lines.push(Array.from({ length: winLength }, (_, i) => index(row + i, col - i)));
      }
    }
  }

  return lines;
}

function emptyState(): State {
  return {
    teams: [
      { mark: "x", players: [], order: [], rotationIndex: 0 },
      { mark: "o", players: [], order: [], rotationIndex: 0 },
    ],
    board: Array.from({ length: DEFAULT_GRID_SIZE * DEFAULT_GRID_SIZE }, () => ({ song: null, owner: null }) as Cell),
    gridSize: DEFAULT_GRID_SIZE,
    winLength: defaultWinLength(DEFAULT_GRID_SIZE),
    singerMode: "random",
    currentTurn: "x",
    contestedCell: null,
    winner: null,
    winningCells: [],
    playing: false,
  };
}

/** Returns a shuffled array of indices [0, count) (Fisher–Yates). */
function shuffledOrder(count: number): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  return order;
}

/** Picks a random song for a cell, avoiding ones already on the board when possible. */
function pickSong(songs: LocalSong[], used: LocalSong[]): LocalSong | null {
  if (songs.length === 0) return null;
  const available = songs.filter((song) => !used.includes(song));
  const pool = available.length > 0 ? available : songs;
  return pool[Math.floor(Math.random() * pool.length)] ?? null;
}

/** Returns the winning mark and cells if a team has `winLength` in a row, otherwise null. */
export function checkWinner(
  board: Cell[],
  gridSize: number,
  winLength: number,
): { mark: Mark; cells: number[] } | null {
  for (const line of generateWinningLines(gridSize, winLength)) {
    const first = line[0];
    if (first === undefined) continue;
    const owner = board[first]?.owner;
    if (owner && line.every((cellIndex) => board[cellIndex]?.owner === owner)) {
      return { mark: owner, cells: line };
    }
  }
  return null;
}

function isBoardFull(board: Cell[]): boolean {
  return board.every((cell) => cell.owner !== null);
}

function createTicTacToeStore() {
  const [state, setState] = createSignal<State>(emptyState());

  const startGame = (
    teams: [Team, Team],
    songs: LocalSong[],
    gridSize: number,
    winLength: number,
    singerMode: SingerMode,
  ) => {
    const used: LocalSong[] = [];
    const board: Cell[] = Array.from({ length: gridSize * gridSize }, () => {
      const song = pickSong(songs, used);
      if (song) used.push(song);
      return { song, owner: null } as Cell;
    });

    setState({
      teams: [
        { ...teams[0], order: shuffledOrder(teams[0].players.length), rotationIndex: 0 },
        { ...teams[1], order: shuffledOrder(teams[1].players.length), rotationIndex: 0 },
      ],
      board,
      gridSize,
      winLength,
      singerMode,
      currentTurn: Math.random() < 0.5 ? "x" : "o",
      contestedCell: null,
      winner: null,
      winningCells: [],
      playing: true,
    });
  };

  const setContestedCell = (index: number) => {
    setState((prev) => ({ ...prev, contestedCell: index }));
  };

  /** Assigns the cell to a team and updates the winner if a line is completed. */
  const claimCell = (index: number, mark: Mark) => {
    setState((prev) => {
      const board = prev.board.map((cell, i) => (i === index ? { ...cell, owner: mark } : cell));
      const lineWinner = checkWinner(board, prev.gridSize, prev.winLength);
      const winner: State["winner"] = lineWinner?.mark ?? (isBoardFull(board) ? "draw" : null);
      const winningCells = lineWinner?.cells ?? [];
      return { ...prev, board, contestedCell: null, winner, winningCells };
    });
  };

  /** Replaces the song on a cell with a new random one (used on a draw). */
  const rerollCell = (index: number, songs: LocalSong[]) => {
    setState((prev) => {
      const current = prev.board[index]?.song ?? null;
      const used = prev.board.map((cell) => cell.song).filter((song): song is LocalSong => song !== null);
      // Never re-pick the exact song we're replacing when any alternative exists, otherwise a
      // broken/unplayable song could be rolled onto the same cell again and again.
      const candidates = current ? songs.filter((song) => song !== current) : songs;
      const pool = candidates.length > 0 ? candidates : songs;
      const song = pickSong(pool, used);
      const board = prev.board.map((cell, i) => (i === index ? { ...cell, song } : cell));
      return { ...prev, board, contestedCell: null };
    });
  };

  /**
   * Advances the rotation singer of each team and hands the turn to the other team.
   * When a team finishes a full cycle through its players, its order is reshuffled
   * so the next round produces fresh, random matchups.
   */
  const nextTurn = () => {
    setState((prev) => {
      const teams = prev.teams.map((team) => {
        if (team.players.length === 0) return team;
        const nextIndex = team.rotationIndex + 1;
        if (nextIndex >= team.players.length) {
          return { ...team, order: shuffledOrder(team.players.length), rotationIndex: 0 };
        }
        return { ...team, rotationIndex: nextIndex };
      }) as [Team, Team];
      return { ...prev, teams, currentTurn: prev.currentTurn === "x" ? "o" : "x" };
    });
  };

  const reset = () => {
    setState(emptyState());
  };

  return {
    state,
    setState,
    startGame,
    setContestedCell,
    claimCell,
    rerollCell,
    nextTurn,
    reset,
  };
}

export const ticTacToeStore = createTicTacToeStore();

/** Returns the team for a given mark. */
export function getTeam(state: State, mark: Mark): Team {
  return state.teams[0].mark === mark ? state.teams[0] : state.teams[1];
}

/** Returns the index (into `players`) of the player whose turn it is to sing. */
export function getCurrentSingerIndex(team: Team): number | null {
  if (team.players.length === 0) return null;
  return team.order[team.rotationIndex % team.order.length] ?? null;
}

/** Returns the player whose turn it is to sing for the given team. */
export function getCurrentSinger(team: Team): User | null {
  const index = getCurrentSingerIndex(team);
  return index === null ? null : (team.players[index] ?? null);
}
