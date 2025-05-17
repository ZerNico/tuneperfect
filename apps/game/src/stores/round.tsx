import { type LinkProps, useNavigate } from "@tanstack/solid-router";
import { createSignal } from "solid-js";
import type { User } from "~/lib/types";
import type { LocalSong } from "~/lib/ultrastar/parser/local";

export interface RoundSettings {
  song: LocalSong;
  players: (User | undefined)[];
  voices: number[];
  returnTo?: LinkProps["to"];
}

export interface Score {
  normal: number;
  golden: number;
  bonus: number;
}

function createRoundStore() {
  const [settings, setSettings] = createSignal<RoundSettings>();
  const [scores, setScores] = createSignal<Score[]>([]);

  const reset = () => {
    setSettings(undefined);
    setScores([]);
  };

  return {
    settings,
    scores,
    setSettings,
    setScores,
    reset,
  };
}

export const roundStore = createRoundStore();

export function useRoundActions() {
  const navigate = useNavigate();

  const startRound = (settings: RoundSettings) => {
    roundStore.setSettings(settings);
    roundStore.setScores([]);
    navigate({ to: "/game" });
  };

  const endRound = (scores: Score[]) => {
    roundStore.setScores(scores);
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
