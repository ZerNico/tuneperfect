import { safe } from "@orpc/client";
import { useQueryClient } from "@tanstack/solid-query";
import { useNavigate } from "@tanstack/solid-router";

import { sessionQueryOptions } from "~/lib/auth";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { notify } from "~/lib/toast";

/** Signs out, clears all cached data and goes to sign-in. */
export function useSignOut() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  return async () => {
    const [error] = await safe(client.auth.signOut.call());
    if (error) {
      notify({ message: t("error.unknown"), intent: "error" });
      return;
    }

    // Navigate first: clearing while signed-in pages are mounted would refetch them all into 401s.
    // The session query stays (now empty): the header and footer keep following it for the next sign-in.
    const sessionKey = sessionQueryOptions().queryKey;
    queryClient.setQueryData(sessionKey, null);
    await navigate({ to: "/sign-in" });
    queryClient.removeQueries({ predicate: (query) => query.queryKey[0] !== sessionKey[0] });
  };
}
