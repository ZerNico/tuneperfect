import { createFileRoute, Outlet, redirect } from "@tanstack/solid-router";
import * as v from "valibot";

import { sessionQueryOptions } from "~/lib/auth";
import { tryCatch } from "~/lib/utils/try-catch";

export const Route = createFileRoute("/_auth/_no-lobby")({
  component: NoLobbyLayout,
  validateSearch: v.object({
    redirect: v.optional(v.string()),
  }),
  beforeLoad: async ({ context, location }) => {
    const [_error, session] = await tryCatch(context.queryClient.ensureQueryData(sessionQueryOptions()));

    if (session?.lobbyId !== null) {
      // A join link for another game switches to it: joining moves you out of the current one
      const code = location.pathname.match(/^\/join\/([^/]+)/)?.[1];
      if (session?.lobbyId && code && code.toUpperCase() !== session.lobbyId) return;
      throw redirect({ to: "/" });
    }
  },
});

function NoLobbyLayout() {
  return <Outlet />;
}
