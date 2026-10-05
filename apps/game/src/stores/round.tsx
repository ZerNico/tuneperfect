import { type LinkProps, useLocation, useNavigate } from "@tanstack/solid-router";
import { createSignal } from "solid-js";

import { t } from "~/lib/i18n";
import { notify } from "~/lib/toast";
import type { User } from "~/lib/types";
import { getMedleySong } from "~/lib/ultrastar/medley";
import { type Song, isLocalSong } from "~/lib/ultrastar/song";
import { withVoices } from "~/lib/ultrastar/song-voices";
import { tryCatch } from "~/lib/utils/try-catch";

import type { Microphone } from "./settings";

export interface PlayerSelection {
  player: User;
  voice: number;
  microphone: Microphone;
}

export type RoundMode = "single" | "medley";
export type RoundLength = "full" | "medium" | "short";

const TARGET_DURATION_MS: Record<RoundLength, number | null> = {
  full: null,
  medium: 60_000,
  short: 30_000,
};

export interface QueuedSong {
  song: Song;
  players: PlayerSelection[];
  mode: RoundMode;
  length: RoundLength;
}

export interface Score {
  normal: number;
  golden: number;
  bonus: number;
}

export interface PlayerStats {
  maxCombo: number;
  notesHit: number;
  notesTotal: number;
  goldenNotesHit: number;
  goldenNotesTotal: number;
  perfectPhrases: number;
  phrasesTotal: number;
}

export function createEmptyStats(): PlayerStats {
  return {
    maxCombo: 0,
    notesHit: 0,
    notesTotal: 0,
    goldenNotesHit: 0,
    goldenNotesTotal: 0,
    perfectPhrases: 0,
    phrasesTotal: 0,
  };
}

interface Result {
  scores: Score[];
  stats: PlayerStats[];
  song: QueuedSong;
}

export interface RoundSettings {
  songs: QueuedSong[];
  returnTo?: LinkProps["to"];
}

function createRoundStore() {
  const [settings, setSettings] = createSignal<RoundSettings>();
  const [results, setResults] = createSignal<Result[]>([]);

  const reset = () => {
    setSettings(undefined);
    setResults([]);
  };

  return {
    settings,
    results,
    setSettings,
    setResults,
    reset,
  };
}

export const roundStore = createRoundStore();

/** A round is being started (its songs' notes are loading); further starts are ignored until it's done. */
let startingRound = false;

export function useRoundActions() {
  const navigate = useNavigate();
  const location = useLocation();

  /**
   * Loads the songs' notes, then starts the round. `commit` runs only once the round actually
   * starts, for state that belongs to it (a contested cell, clearing the medley queue). Resolves to
   * whether it started: not when another start is in flight, loading failed, or the screen was left.
   */
  const startRound = async (settings: RoundSettings, commit?: () => void): Promise<boolean> => {
    if (startingRound) return false;
    startingRound = true;
    const startedFrom = location().pathname;

    try {
      // Local songs come from the library without their notes; load them for the songs being played.
      const [error, loaded] = await tryCatch(
        Promise.all(
          settings.songs.map(async (queued) =>
            isLocalSong(queued.song) ? { ...queued, song: await withVoices(queued.song) } : queued,
          ),
        ),
      );
      if (error) {
        console.error("Failed to load the songs' notes:", error);
        notify({ message: t("game.songFailed"), intent: "error" });
        return false;
      }
      if (location().pathname !== startedFrom) return false;

      commit?.();
      setRound(settings, loaded);
      return true;
    } finally {
      startingRound = false;
    }
  };

  const setRound = (settings: RoundSettings, loaded: QueuedSong[]) => {
    const songs = loaded.map((queued) => {
      const targetDurationMs = TARGET_DURATION_MS[queued.length];
      // Only local songs can be trimmed to a medley; online songs play full.
      if (targetDurationMs === null || !isLocalSong(queued.song)) {
        return queued;
      }
      return {
        ...queued,
        song: getMedleySong(queued.song, targetDurationMs),
      };
    });
    roundStore.setSettings({ ...settings, songs });
    roundStore.setResults([]);
    navigate({ to: "/game" });
  };

  /** Leaves a round that never got going (e.g. the microphones didn't start) without a result, so
   * party modes don't count it as an unplayable song. */
  const abortRound = () => {
    navigate({ to: roundStore.settings()?.returnTo ?? "/sing" });
  };

  const endRound = (scores: Score[], stats: PlayerStats[]) => {
    const song = roundStore.settings()?.songs[0];
    if (!song) return;

    roundStore.setResults((prev) => [...prev, { scores, stats, song }]);

    const nextSong = roundStore.settings()?.songs[1];

    if (nextSong) {
      navigate({ to: "/game/next" });

      return;
    }

    navigate({ to: "/game/score" });
  };

  const endMedley = (scores: Score[], stats: PlayerStats[]) => {
    const song = roundStore.settings()?.songs[0];
    if (!song) return;

    roundStore.setResults((prev) => [...prev, { scores, stats, song }]);
    roundStore.setSettings((prev) => (prev ? { ...prev, songs: prev.songs.slice(0, 1) } : prev));

    navigate({ to: "/game/score" });
  };

  const returnRound = () => {
    navigate({ to: roundStore.settings()?.returnTo ?? "/sing" });
  };

  // The current song could not be played (e.g. unsupported media). Record an empty-score
  // result so party modes can detect the failure (and e.g. swap the song) instead of
  // navigating back with a stale or missing result, then return to the party screen.
  const failRound = () => {
    const song = roundStore.settings()?.songs[0];
    if (song) {
      roundStore.setResults((prev) => [...prev, { scores: [], stats: [], song }]);
    }
    navigate({ to: roundStore.settings()?.returnTo ?? "/sing" });
  };

  return {
    startRound,
    endRound,
    endMedley,
    returnRound,
    failRound,
    abortRound,
  };
}
