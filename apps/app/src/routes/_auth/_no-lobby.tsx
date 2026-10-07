import { createFileRoute, Outlet, redirect } from "@tanstack/solid-router";
import * as v from "valibot";

import { sessionQueryOptions } from "~/lib/auth";
import { t } from "~/lib/i18n";
import { notify } from "~/lib/toast";
import { tryCatch } from "~/lib/utils/try-catch";

export const Route = createFileRoute("/_auth/_no-lobby")({
  component: NoLobbyLayout,
  validateSearch: v.object({
    redirect: v.optional(v.string()),
  }),
  beforeLoad: async ({ context, location, preload }) => {
    const [_error, session] = await tryCatch(context.queryClient.ensureQueryData(sessionQueryOptions()));

    if (session?.lobbyId !== null) {
      // A join link for another game would otherwise just land in the current one without a word
      const code = location.pathname.match(/^\/join\/([^/]+)/)?.[1];
      if (!preload && session?.lobbyId && code && code.toUpperCase() !== session.lobbyId) {
        notify({ intent: "error", message: t("join.alreadyInLobby") });
      }
      throw redirect({ to: "/" });
    }
  },
});

function NoLobbyLayout() {
  return <Outlet />;
}
