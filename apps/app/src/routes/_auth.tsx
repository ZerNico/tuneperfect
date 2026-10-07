import { createEventListener } from "@solid-primitives/event-listener";
import { useQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/solid-router";
import { createEffect, createMemo, on, onCleanup } from "solid-js";
import * as v from "valibot";

import { OfflineErrorUI } from "~/components/connection-state";
import { sessionQueryOptions } from "~/lib/auth";
import { tryCatch } from "~/lib/utils/try-catch";
import { startConnection, stopConnection } from "~/stores/connection";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  errorComponent: OfflineErrorUI,
  validateSearch: v.object({
    redirect: v.optional(v.string()),
  }),
  beforeLoad: async ({ context, location, search }) => {
    const [error, session] = await tryCatch(context.queryClient.ensureQueryData(sessionQueryOptions()));

    // Couldn't ask (offline, server trouble): not the same as signed out, so no trip to sign-in
    if (error) throw error;
    if (session === null) {
      throw redirect({ to: "/sign-in", search: { redirect: search.redirect ?? location.pathname } });
    }

    if (session.username === null) {
      if (location.pathname === "/complete-profile") {
        return;
      }

      throw redirect({ to: "/complete-profile", search: { redirect: search.redirect ?? location.pathname } });
    }

    if (session.id && session.lobbyId) {
      startConnection(session.id);
    }
  },
});

function AuthLayout() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const session = useQuery(() => sessionQueryOptions());

  createEventListener(window, "session:expired", () => {
    // Otherwise sign-in finds the cached session and sends us straight back
    queryClient.setQueryData(sessionQueryOptions().queryKey, null);
    navigate({ to: "/sign-in", search: { redirect: location.pathname } });
  });

  // Only a different user or lobby changes the connection, not every session refetch.
  const lobbyMember = createMemo(() => {
    const userId = session.data?.id;
    return userId && session.data?.lobbyId ? `${userId}\n${session.data.lobbyId}` : null;
  });
  createEffect(
    on(lobbyMember, (member, previous) => {
      const userId = session.data?.id;
      // A different lobby is a different game: start over (the first run continues `beforeLoad`'s start).
      if (previous && previous !== member) stopConnection();
      if (member && userId) {
        startConnection(userId);
      } else {
        stopConnection();
      }
    }),
  );

  onCleanup(() => {
    stopConnection();
  });

  return <Outlet />;
}
