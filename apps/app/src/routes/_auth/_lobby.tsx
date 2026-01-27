import { useQuery } from "@tanstack/solid-query";
import { createFileRoute, Outlet, redirect } from "@tanstack/solid-router";
import { createEffect, onCleanup } from "solid-js";
import * as v from "valibot";
import { sessionQueryOptions } from "~/lib/auth";
import { tryCatch } from "~/lib/utils/try-catch";
import { startConnection, stopConnection } from "~/stores/webrtc";

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
  const session = useQuery(() => sessionQueryOptions());

  // Connect to game host when entering lobby and user is available
  createEffect(() => {
    const userId = session.data?.id;
    if (userId) {
      startConnection(userId);
    }
  });

  // Disconnect when leaving lobby routes
  onCleanup(() => {
    stopConnection();
  });

  return <Outlet />;
}
