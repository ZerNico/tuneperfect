import { createEventListener } from "@solid-primitives/event-listener";
import { createQuery } from "@tanstack/solid-query";
import { Outlet, createFileRoute, redirect, useNavigate } from "@tanstack/solid-router";
import { createEffect } from "solid-js";
import * as v from "valibot";
import { sessionQueryOptions } from "~/lib/auth";
import { tryCatch } from "~/lib/utils/try-catch";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  validateSearch: v.object({
    redirect: v.optional(v.string()),
  }),
  beforeLoad: async ({ context, location, search }) => {
    const [error, session] = await tryCatch(context.queryClient.ensureQueryData(sessionQueryOptions()));

    if (error || session === null) {
      throw redirect({ to: "/sign-in", search: { redirect: search.redirect ?? location.pathname } });
    }

    if (session.username === null) {
      if (location.pathname === "/complete-profile") {
        return;
      }

      throw redirect({ to: "/complete-profile", search: { redirect: search.redirect ?? location.pathname } });
    }
  },
});

function AuthLayout() {
  const navigate = useNavigate();

  createEventListener(window, "session:expired", () => {
    navigate({ to: "/sign-in", search: { redirect: location.pathname } });
  });

  return <Outlet />;
}
