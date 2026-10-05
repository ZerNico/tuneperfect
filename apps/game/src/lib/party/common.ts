import { t } from "~/lib/i18n";
import { notify } from "~/lib/toast";
import type { User } from "~/lib/types";
import { isLocalSong, type LocalSong } from "~/lib/ultrastar/song";
import { getRoundTotalScores } from "~/lib/utils/score";
import { lobbyStore } from "~/stores/lobby";
import { type PlayerSelection, roundStore } from "~/stores/round";
import { settingsStore } from "~/stores/settings";
import { songsStore } from "~/stores/songs";

/** Party modes, keyed like their `party.*` translations. */
export type PartyMode = "versus" | "ticTacToe";
/** A side in a duel: the first player sings on microphone 1, the second on microphone 2. */
export type DuelSlot = 0 | 1;

/** Songs party modes play: a single voice, so both players sing the same part. */
export function partySongs(): LocalSong[] {
  return songsStore.songs().filter((song) => song.voiceCount === 1);
}

/** Everyone who can join a party game: the lobby's online users and the local players added to it. */
export function partyUsers(lobbyUsers: User[] | undefined): User[] {
  return [...(lobbyUsers ?? []), ...lobbyStore.localPlayersInLobby()];
}

/** Checks what every party mode needs to start (players, two microphones, songs); tells the user what's missing. */
export function validatePartyStart(users: User[], mode: PartyMode): boolean {
  const error =
    users.length < 2
      ? t(`party.${mode}.notEnoughPlayers`)
      : settingsStore.microphones().length < 2
        ? t(`party.${mode}.microphoneRequired`)
        : partySongs().length === 0
          ? t(`party.${mode}.noSongs`)
          : null;

  if (error) {
    notify({ message: error, intent: "error" });
    return false;
  }
  return true;
}

/** The colour of a duel side: its microphone's colour, or sky/red when that microphone isn't set up. */
export function slotColor(slot: DuelSlot): string {
  return settingsStore.microphones()[slot]?.color ?? (slot === 0 ? "sky" : "red");
}

/** The two singers of a duel on microphones 1 and 2, or null (with a toast) when a microphone is missing. */
export function buildDuelPlayers(a: User, b: User, mode: PartyMode): PlayerSelection[] | null {
  const [micA, micB] = settingsStore.microphones();
  if (!micA || !micB) {
    notify({ message: t(`party.${mode}.microphoneRequired`), intent: "error" });
    return null;
  }

  return [
    { player: a, voice: 0, microphone: micA },
    { player: b, voice: 0, microphone: micB },
  ];
}

type RoundResult = ReturnType<typeof roundStore.results>[number];

export type DuelResult =
  /** The song couldn't be played (or the result is unusable): no winner, the song should be replaced. */
  | { kind: "failed"; song: LocalSong | null }
  | { kind: "scored"; song: LocalSong; players: [User, User]; scores: [number, number] };

/** Reads a duel's round result: both players' total scores, or `failed` when the round produced none. */
export function readDuelResult(result: RoundResult): DuelResult {
  const song = result.song.song;
  if (!isLocalSong(song)) return { kind: "failed", song: null };

  const voice = song.voices[0];
  const [a, b] = result.song.players;
  // A failed round (see `failRound`) records no scores.
  if (!voice || !a || !b || result.scores.length !== 2) return { kind: "failed", song };

  const [scoreA = 0, scoreB = 0] = getRoundTotalScores(result.scores, voice);
  return { kind: "scored", song, players: [a.player, b.player], scores: [scoreA, scoreB] };
}

/**
 * The result of the last duel that returned to `returnTo`, or null when there is none. Clears the round, so a
 * result is only ever processed once (loaders run again, e.g. when coming back from the settings).
 */
export function takeDuelResult(returnTo: "/party/versus" | "/party/tic-tac-toe"): DuelResult | null {
  if (roundStore.settings()?.returnTo !== returnTo) return null;

  const result = roundStore.results().at(-1);
  roundStore.reset();
  return result ? readDuelResult(result) : null;
}
