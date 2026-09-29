import { createFileRoute } from "@tanstack/solid-router";
import { batch } from "solid-js";

import { isLocalSong } from "~/lib/ultrastar/song";
import { getRoundTotalScores } from "~/lib/utils/score";
import TicTacToeScreen from "~/screens/party/tic-tac-toe/index";
import { type Mark, ticTacToeStore } from "~/stores/party/tic-tac-toe";
import { roundStore } from "~/stores/round";
import { songsStore } from "~/stores/songs";

export const Route = createFileRoute("/party/tic-tac-toe/")({
  component: TicTacToeScreen,
  loader: async () => {
    if (roundStore.settings()?.returnTo !== "/party/tic-tac-toe") return;

    const lastResult = roundStore.results().at(-1);
    if (!lastResult) return;

    const state = ticTacToeStore.state();
    const contestedCell = state.contestedCell;
    if (contestedCell === null) return;

    const singleVoiceSongs = songsStore.songs().filter((s) => s.voices.length === 1);

    // The contested song could not produce a valid outcome (e.g. it failed to play, or the round
    // was aborted) -> treat it as a draw and swap in a new song on the same cell.
    const rerollAndReset = () => {
      batch(() => {
        ticTacToeStore.rerollCell(contestedCell, singleVoiceSongs);
        roundStore.reset();
      });
    };

    const song = lastResult.song.song;
    if (!isLocalSong(song)) {
      rerollAndReset();
      return;
    }

    const voice = song.voices[0];
    const players = lastResult.song.players;
    const scores = lastResult.scores;

    if (scores.length !== 2 || !voice || players.length !== 2) {
      console.warn("Tic Tac Toe: conditions not met for processing round result", { voice, players, scores });
      rerollAndReset();
      return;
    }

    const totalScores = getRoundTotalScores(scores, voice);

    const xScore = totalScores[0] ?? 0;
    const oScore = totalScores[1] ?? 0;

    batch(() => {
      // A tie is a draw: re-roll the song on the same cell and replay rather than awarding it.
      const isDraw = xScore === oScore;
      if (isDraw) {
        ticTacToeStore.rerollCell(contestedCell, singleVoiceSongs);
      } else {
        const winnerMark: Mark = xScore > oScore ? "x" : "o";
        ticTacToeStore.claimCell(contestedCell, winnerMark);
        if (!ticTacToeStore.state().winner) {
          ticTacToeStore.nextTurn();
        }
      }
      roundStore.reset();
    });
  },
});
