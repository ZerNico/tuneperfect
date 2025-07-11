import { createFileRoute, Outlet, redirect } from "@tanstack/solid-router";
import * as v from "valibot";
import { sessionQueryOptions } from "~/lib/auth";
import { tryCatch } from "~/lib/utils/try-catch";

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
  return <Outlet />;
}
