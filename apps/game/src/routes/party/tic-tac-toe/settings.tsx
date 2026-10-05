import { createFileRoute } from "@tanstack/solid-router";

import { lobbyQueryOptions } from "~/lib/queries";
import TicTacToeSettingsScreen from "~/screens/party/tic-tac-toe/settings";

export const Route = createFileRoute("/party/tic-tac-toe/settings")({
  component: TicTacToeSettingsScreen,
  beforeLoad: async ({ context }) => {
    context.queryClient.prefetchQuery(lobbyQueryOptions());
  },
});
