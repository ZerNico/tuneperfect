import { createFileRoute } from "@tanstack/solid-router";
import { batch } from "solid-js";

import { isLocalSong } from "~/lib/ultrastar/song";
import { getRoundTotalScores } from "~/lib/utils/score";
import VersusScreen from "~/screens/party/versus/index";
import { type Round, versusStore } from "~/stores/party/versus";
import { roundStore } from "~/stores/round";

export const Route = createFileRoute("/party/versus/")({
  component: VersusScreen,
  loader: async () => {
    if (roundStore.settings()?.returnTo !== "/party/versus") return;
    const lastResult = roundStore.results().at(-1);
    if (!lastResult) return;

    const song = lastResult.song.song;
    // Versus mode only ever plays local songs.
    if (!isLocalSong(song)) return;
    const voice = song.voices[0];
    const players = lastResult.song.players;
    const scores = lastResult.scores;

    versusStore.setState((state) => ({ ...state, playedSongs: [...state.playedSongs, song] }));

    if (scores.length !== 2 || !voice || players.length !== 2) {
      console.warn("Conditions not met for processing round results:", { voice, players, scores });
      return;
    }

    const totalScores = getRoundTotalScores(scores, voice);
    if (totalScores.every((score) => score === 0)) {
      console.warn("All scores are zero, skipping round result processing.");
      return;
    }

    batch(() => {
      const rounds = { ...versusStore.state().rounds };
      for (const [index, player] of players.entries()) {
        if (!player) continue;
        const score = totalScores[index] ?? 0;
        const other = totalScores[1 - index] ?? 0;
        const result: Round["result"] = score > other ? "win" : score < other ? "lose" : "draw";
        rounds[player.player.id] = [...(rounds[player.player.id] ?? []), { result, score }];
      }

      versusStore.setState((state) => ({ ...state, rounds, matchups: state.matchups.slice(1) }));

      roundStore.reset();
    });
  },
});
