import { createFileRoute, Outlet, redirect } from "@tanstack/solid-router";
import * as v from "valibot";

import RemoteSheet from "~/components/remote/remote-sheet";
import { GameConnectionProvider } from "~/contexts/game-client";
import { sessionQueryOptions } from "~/lib/auth";
import { createRemote, RemoteProvider } from "~/lib/remote";
import { tryCatch } from "~/lib/utils/try-catch";
import { createGameConnection } from "~/lib/webrtc/game-connection";

export const Route = createFileRoute("/_auth/_lobby")({
  component: LobbyLayout,
  validateSearch: v.object({
    redirect: v.optional(v.string()),
  }),
  beforeLoad: async ({ context }) => {
    const [_error, session] = await tryCatch(context.queryClient.ensureQueryData(sessionQueryOptions()));

    if (session?.lobbyId === null) {
      throw redirect({ to: "/join" });
    }
  },
});

function LobbyLayout() {
  // One game link for the whole lobby, so the lobby screen and the song list share it.
  const gameConnection = createGameConnection();
  // Likewise one follow of the game's remote state, so the pop-up works on every lobby screen.
  const remote = createRemote(gameConnection);

  return (
    <GameConnectionProvider client={gameConnection}>
      <RemoteProvider remote={remote}>
        <Outlet />
        <RemoteSheet />
      </RemoteProvider>
    </GameConnectionProvider>
  );
}
