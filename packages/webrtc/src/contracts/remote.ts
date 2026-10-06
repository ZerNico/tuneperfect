import { eventIterator, oc } from "@orpc/contract";
import * as v from "valibot";

/**
 * Phones controlling the game. The game tells each phone what its user can do right now (a panel)
 * and the phone sends actions back. All game logic stays in the game: a phone only shows what it's
 * told and asks.
 *
 * Phones and games of different versions meet, so both sides must cope with the other knowing
 * more: a phone shows a fallback for a panel kind it doesn't know, and the game turns down an
 * action type it doesn't know. Only add new variants, never change existing ones.
 */

/** Whether games answer `remote.*`; phones only offer the controller when `ping` lists it. */
export const REMOTE_FEATURE = "remote";

const MarkSchema = v.picklist(["x", "o"]);

const SongSchema = v.object({ hash: v.string(), title: v.string(), artist: v.string() });

/** Your duel in versus: your jokers (a joker re-rolls the song) and who you're up against. */
const VersusPanelSchema = v.object({
  kind: v.literal("versus"),
  /** Your mic: 0 sings on mic 1. */
  slot: v.picklist([0, 1]),
  /** The mic's colour name (e.g. "sky"), as the game shows it. */
  color: v.string(),
  jokers: v.number(),
  maxJokers: v.number(),
  opponent: v.object({ name: v.string(), jokers: v.number() }),
  canReroll: v.boolean(),
  song: v.nullable(SongSchema),
});

/** Someone else's duel in versus. */
const VersusWatchPanelSchema = v.object({
  kind: v.literal("versus.watch"),
  players: v.tuple([v.string(), v.string()]),
  song: v.nullable(SongSchema),
});

/** The tic tac toe board. Players of the team on turn pick a cell, the others watch. */
const TicTacToeBoardPanelSchema = v.object({
  kind: v.literal("ticTacToe.board"),
  /** Your team. */
  mark: MarkSchema,
  turn: MarkSchema,
  /** Each team's colour name (its mic's). */
  colors: v.object({ x: v.string(), o: v.string() }),
  size: v.number(),
  cursor: v.number(),
  cells: v.array(v.object({ song: v.nullable(SongSchema), owner: v.nullable(MarkSchema) })),
});

/** Your team chooses who sings for the cell. */
const TicTacToeSingerPanelSchema = v.object({
  kind: v.literal("ticTacToe.singer"),
  mark: MarkSchema,
  color: v.string(),
  song: v.nullable(SongSchema),
  players: v.array(v.object({ id: v.string(), name: v.string() })),
  cursor: v.number(),
});

/** The other team chooses its singer. */
const TicTacToeWaitPanelSchema = v.object({
  kind: v.literal("ticTacToe.wait"),
  mark: MarkSchema,
  /** The team that is choosing. */
  choosing: MarkSchema,
});

export const PanelSchema = v.variant("kind", [
  VersusPanelSchema,
  VersusWatchPanelSchema,
  TicTacToeBoardPanelSchema,
  TicTacToeSingerPanelSchema,
  TicTacToeWaitPanelSchema,
]);

/**
 * The game's own buttons, for phones with full control. These are the game's navigation actions
 * (what its keys and gamepad buttons do), so a phone presses exactly what a key would.
 */
export const NAV_ACTIONS = [
  "up",
  "down",
  "left",
  "right",
  "confirm",
  "back",
  "menu",
  "search",
  "filter",
  "random",
  "clear",
  "skip",
  "instrumental",
  "sort-left",
  "sort-right",
  "filter-left",
  "filter-right",
  "zoom-in",
  "zoom-out",
  "add-to-medley",
  "remove-from-medley",
  "medley-up",
  "medley-down",
  "start-random-medley",
  "joker-1",
  "joker-2",
] as const;

const NavActionSchema = v.picklist(NAV_ACTIONS);

export const RemoteStateSchema = v.object({
  /** `full`: the phone may drive the whole game with navigation actions. */
  control: v.picklist(["full", "none"]),
  /**
   * With full control: what the game's current screen offers, so the phone only shows those.
   * `enabled: false` means the screen has it but it does nothing right now (the phone shows it
   * disabled rather than moving its other buttons). A phone skips actions it doesn't know.
   */
  actions: v.array(v.object({ action: NavActionSchema, enabled: v.boolean() })),
  /** Which screen the game is on, so a phone keeps a screen's buttons in place while it stays there. */
  screen: v.string(),
  panel: v.nullable(PanelSchema),
  /** It's this user's move: the phone brings the panel up and vibrates. */
  attention: v.boolean(),
});

export const ActionSchema = v.variant("type", [
  v.object({ type: v.literal("nav"), action: NavActionSchema }),
  v.object({ type: v.literal("versus.reroll") }),
  /** Moves the board cursor (everyone sees it on the screen) without picking. */
  v.object({ type: v.literal("ticTacToe.cursor"), cell: v.number() }),
  v.object({ type: v.literal("ticTacToe.pick"), cell: v.number() }),
  v.object({ type: v.literal("ticTacToe.singerCursor"), index: v.number() }),
  v.object({ type: v.literal("ticTacToe.singerPick"), index: v.number() }),
]);

export const ActResultSchema = v.variant("ok", [
  v.object({ ok: v.literal(true) }),
  v.object({
    ok: v.literal(false),
    /** `not-allowed`: not your move. `stale`: the game moved on. `unavailable`: nothing takes it right now. */
    reason: v.picklist(["not-allowed", "stale", "unavailable"]),
  }),
]);

export type Panel = v.InferOutput<typeof PanelSchema>;
export type RemoteState = v.InferOutput<typeof RemoteStateSchema>;
export type RemoteAction = v.InferOutput<typeof ActionSchema>;
export type NavAction = (typeof NAV_ACTIONS)[number];
export type ActResult = v.InferOutput<typeof ActResultSchema>;

export const remoteContract = {
  /** This user's state, now and after every change, until the phone stops listening. */
  watch: oc.output(eventIterator(RemoteStateSchema)),
  act: oc.input(ActionSchema).output(ActResultSchema),
};
