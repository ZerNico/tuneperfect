import { Outlet, createFileRoute, redirect } from "@tanstack/solid-router";
import * as v from "valibot";
import { sessionQueryOptions } from "~/lib/queries";
import { tryCatch } from "~/lib/utils/try-catch";

export const Route = createFileRoute("/_auth")({
  component: AuthLayout,
  validateSearch: v.object({
    redirect: v.optional(v.string()),
  }),
  beforeLoad: async ({ context, location, search }) => {
    const [session, error] = await tryCatch(context.queryClient.ensureQueryData(sessionQueryOptions()));

    if (error || session === null) {
      throw redirect({ to: "/sign-in", search: { redirect: search.redirect ?? location.pathname } });
    }

    if (session.user.username === null) {
      if (location.pathname === "/complete-profile") {
        return;
      }

      throw redirect({ to: "/complete-profile", search: { redirect: search.redirect ?? location.pathname } });
    }
  },
});

function AuthLayout() {
  return <Outlet />;
}
