import { useNavigate } from "@tanstack/solid-router";
import { createSignal } from "solid-js";
import type { User } from "~/lib/types";
import type { LocalSong } from "~/lib/ultrastar/parser/local";

export interface RoundSettings {
  song: LocalSong;
  players: (User | undefined)[];
  voices: number[];
}

export interface Score {
  normal: number;
  golden: number;
  bonus: number;
}

const [settings, setSettings] = createSignal<RoundSettings>();
const [scores, setScores] = createSignal<Score[]>([]);

export function useRoundStore() {
  const navigate = useNavigate();

  const startRound = (settings: RoundSettings) => {
    setSettings(settings);
    setScores([]);
    navigate({ to: "/game" });
  };

  const endRound = (scores: Score[]) => {
    setScores(scores);
    navigate({ to: "/game/score" });
  };

  return {
    settings,
    scores,
    startRound,
    endRound,
  };
}
