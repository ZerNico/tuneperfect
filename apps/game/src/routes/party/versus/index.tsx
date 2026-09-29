import { createFileRoute } from "@tanstack/solid-router";
import { batch } from "solid-js";

import { takeDuelResult } from "~/lib/party/common";
import VersusScreen from "~/screens/party/versus/index";
import { type Round, versusStore } from "~/stores/party/versus";

export const Route = createFileRoute("/party/versus/")({
  component: VersusScreen,
  loader: async () => {
    const result = takeDuelResult("/party/versus");
    if (!result) return;

    // The song couldn't be played: the same matchup gets a new song (the screen never picks a failed one again),
    // without a result and without costing a joker.
    if (result.kind === "failed") {
      if (result.song) versusStore.markSongFailed(result.song);
      return;
    }

    const { song, players, scores } = result;
    versusStore.addPlayedSong(song);

    // Nobody sang: no result, the matchup stays and gets another song.
    if (scores.every((score) => score === 0)) {
      console.warn("All scores are zero, skipping round result processing.");
      return;
    }

    batch(() => {
      const rounds = { ...versusStore.state().rounds };
      for (const [index, player] of players.entries()) {
        const score = scores[index] ?? 0;
        const other = scores[1 - index] ?? 0;
        const outcome: Round["result"] = score > other ? "win" : score < other ? "lose" : "draw";
        rounds[player.id] = [...(rounds[player.id] ?? []), { result: outcome, score }];
      }

      versusStore.setState((state) => ({ ...state, rounds, matchups: state.matchups.slice(1) }));
    });
  },
});
