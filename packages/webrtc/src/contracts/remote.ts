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

const OptionSchema = v.object({ value: v.string(), label: v.string() });

/**
 * Extras for phones with full control, shown with the pad where a pad is clumsy. `surface` says
 * which mounted screen they belong to: the game turns down actions for one that's gone. Labels
 * come from the game, in its language (the room's).
 */
const ExtrasSchema = v.object({
  /** The TV wants text (a search, a name): typed on the phone instead of the on-screen keyboard. */
  text: v.optional(
    v.object({
      surface: v.string(),
      label: v.string(),
      /** Empty for secret fields: the game never sends a password back. */
      value: v.string(),
      maxLength: v.optional(v.number()),
      secret: v.optional(v.boolean()),
    }),
  ),
  /** The song select: its sort and filters to pick directly, and the song on the TV. */
  songs: v.optional(
    v.object({
      surface: v.string(),
      sort: v.string(),
      sorts: v.array(OptionSchema),
      /** A filter's `value` is null while it's off; its options don't include "off". */
      filters: v.array(
        v.object({ id: v.string(), label: v.string(), value: v.nullable(v.string()), options: v.array(OptionSchema) }),
      ),
      song: v.nullable(SongSchema),
    }),
  ),
});

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
  /** With full control, where the screen has them. Older games don't send any. */
  extras: v.optional(ExtrasSchema),
});

export const ActionSchema = v.variant("type", [
  v.object({
    type: v.literal("nav"),
    action: NavActionSchema,
    /**
     * `down` and `up` hold the button in between, like a held key (lists keep scrolling). Without
     * it, a tap. The game lets go of a held button by itself if the `up` never comes.
     */
    state: v.optional(v.picklist(["down", "up"])),
  }),
  v.object({ type: v.literal("versus.reroll") }),
  /** Moves the board cursor (everyone sees it on the screen) without picking. */
  v.object({ type: v.literal("ticTacToe.cursor"), cell: v.number() }),
  v.object({ type: v.literal("ticTacToe.pick"), cell: v.number() }),
  v.object({ type: v.literal("ticTacToe.singerCursor"), index: v.number() }),
  v.object({ type: v.literal("ticTacToe.singerPick"), index: v.number() }),
  // Extras (with full control).
  v.object({ type: v.literal("text"), surface: v.string(), value: v.pipe(v.string(), v.maxLength(500)) }),
  v.object({ type: v.literal("songs.sort"), surface: v.string(), sort: v.string() }),
  v.object({ type: v.literal("songs.filter"), surface: v.string(), filter: v.string(), value: v.nullable(v.string()) }),
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
export type Extras = v.InferOutput<typeof ExtrasSchema>;

export const remoteContract = {
  /** This user's state, now and after every change, until the phone stops listening. */
  watch: oc.output(eventIterator(RemoteStateSchema)),
  act: oc.input(ActionSchema).output(ActResultSchema),
};
