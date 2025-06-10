import { createFileRoute, Outlet, redirect } from "@tanstack/solid-router";
import { sessionQueryOptions } from "~/lib/auth";
import { tryCatch } from "~/lib/utils/try-catch";

export const Route = createFileRoute("/_no-auth")({
  component: NoAuthLayout,
  beforeLoad: async ({ context }) => {
    const [_error, session] = await tryCatch(context.queryClient.ensureQueryData(sessionQueryOptions()));

    if (session !== null) {
      throw redirect({ to: "/" });
    }
  },
});

function NoAuthLayout() {
  return <Outlet />;
}
