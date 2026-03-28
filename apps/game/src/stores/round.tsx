import { type LinkProps, useNavigate } from "@tanstack/solid-router";
import { createSignal } from "solid-js";

import type { User } from "~/lib/types";
import { getMedleySong } from "~/lib/ultrastar/medley";
import { type Song, isLocalSong } from "~/lib/ultrastar/song";

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

interface Result {
  scores: Score[];
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

export function useRoundActions() {
  const navigate = useNavigate();

  const startRound = (settings: RoundSettings) => {
    const songs = settings.songs.map((queued) => {
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

  const endRound = (scores: Score[]) => {
    const song = roundStore.settings()?.songs[0];
    if (!song) return;

    roundStore.setResults((prev) => [...prev, { scores, song }]);

    const nextSong = roundStore.settings()?.songs[1];

    if (nextSong) {
      navigate({ to: "/game/next" });

      return;
    }

    navigate({ to: "/game/score" });
  };

  const endMedley = (scores: Score[]) => {
    const song = roundStore.settings()?.songs[0];
    if (!song) return;

    roundStore.setResults((prev) => [...prev, { scores, song }]);
    roundStore.setSettings((prev) => (prev ? { ...prev, songs: prev.songs.slice(0, 1) } : prev));

    navigate({ to: "/game/score" });
  };

  const returnRound = () => {
    navigate({ to: roundStore.settings()?.returnTo ?? "/sing" });
  };

  return {
    startRound,
    endRound,
    endMedley,
    returnRound,
  };
}
