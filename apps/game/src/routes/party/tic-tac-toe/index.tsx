import { createFileRoute } from "@tanstack/solid-router";
import { batch } from "solid-js";

import { partySongs, takeDuelResult } from "~/lib/party/common";
import TicTacToeScreen from "~/screens/party/tic-tac-toe/index";
import { type Mark, ticTacToeStore } from "~/stores/party/tic-tac-toe";

export const Route = createFileRoute("/party/tic-tac-toe/")({
  component: TicTacToeScreen,
  loader: async () => {
    const result = takeDuelResult("/party/tic-tac-toe");
    if (!result) return;

    const contestedCell = ticTacToeStore.state().contestedCell;
    if (contestedCell === null) return;

    // The song couldn't produce a valid outcome (e.g. it failed to play), or the round was a tie:
    // swap in a new song on the same cell and replay rather than awarding it.
    if (result.kind === "failed") {
      console.warn("Tic Tac Toe: the round produced no result, re-rolling the cell");
      ticTacToeStore.rerollCell(contestedCell, partySongs());
      return;
    }

    const [xScore, oScore] = result.scores;
    if (xScore === oScore) {
      ticTacToeStore.rerollCell(contestedCell, partySongs());
      return;
    }

    batch(() => {
      const winnerMark: Mark = xScore > oScore ? "x" : "o";
      ticTacToeStore.claimCell(contestedCell, winnerMark);
      if (!ticTacToeStore.state().winner) {
        ticTacToeStore.nextTurn();
      }
    });
  },
});
