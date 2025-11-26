import { type LinkProps, useNavigate } from "@tanstack/solid-router";
import { createSignal } from "solid-js";
import type { User } from "~/lib/types";
import { getMedleySong } from "~/lib/ultrastar/medley";
import type { LocalSong } from "~/lib/ultrastar/song";

interface QueuedSong {
  song: LocalSong;
  voice: number[];
  players: (User | undefined)[];
  mode: "regular" | "medley";
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
    const songs = settings.songs.map((song) => {
      if (song.mode === "medley") {
        return {
          ...song,
          song: getMedleySong(song.song),
        };
      }
      return song;
    });
    roundStore.setSettings({ ...settings, songs });
    roundStore.setResults([]);
    navigate({ to: "/game" });
  };

  const endRound = (scores: Score[]) => {
    const song = roundStore.settings()?.songs[0];
    if (!song) return;

    roundStore.setResults((prev) => [...prev, { scores, song }]);

    roundStore.setSettings((prev) => {
      if (!prev) return undefined;
      return {
        ...prev,
        songs: prev.songs.slice(1),
      };
    });
    const nextSong = roundStore.settings()?.songs[0];

    if (nextSong) {
      navigate({ to: "/game/restart" });
      return;
    }

    navigate({ to: "/game/score" });
  };

  const returnRound = () => {
    navigate({ to: roundStore.settings()?.returnTo ?? "/sing" });
  };

  return {
    startRound,
    endRound,
    returnRound,
  };
}
