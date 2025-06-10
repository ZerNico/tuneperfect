import { createFileRoute, Outlet, redirect } from "@tanstack/solid-router";
import * as v from "valibot";
import { sessionQueryOptions } from "~/lib/auth";
import { tryCatch } from "~/lib/utils/try-catch";

export const Route = createFileRoute("/_auth/_no-lobby")({
  component: NoLobbyLayout,
  validateSearch: v.object({
    redirect: v.optional(v.string()),
  }),
  beforeLoad: async ({ context }) => {
    const [_error, session] = await tryCatch(context.queryClient.ensureQueryData(sessionQueryOptions()));

    if (session?.lobbyId !== null) {
      throw redirect({ to: "/" });
    }
  },
});

function NoLobbyLayout() {
  return <Outlet />;
}
