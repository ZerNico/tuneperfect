import { createFileRoute, redirect } from "@tanstack/solid-router";

import { lobbyQueryOptions } from "~/lib/queries";
import RouteScreen from "~/screens/lobby/$id";

export const Route = createFileRoute("/lobby/$id")({
  component: RouteScreen,
  beforeLoad: async ({ context, params }) => {
    const userId = params.id;

    const lobby = await context.queryClient.ensureQueryData(lobbyQueryOptions());

    if (!lobby) {
      throw redirect({ to: "/lobby" });
    }

    if (!lobby.users.some((user) => user.id === userId)) {
      throw redirect({ to: "/lobby" });
    }
  },
});
