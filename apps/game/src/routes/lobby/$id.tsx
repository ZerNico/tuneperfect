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

    const user = lobby.users.find((user) => user.id === userId);
    if (!user) {
      throw redirect({ to: "/lobby" });
    }

    return { data: user };
  },
});
