import { safe } from "@orpc/client";
import { useQueryClient } from "@tanstack/solid-query";
import { useNavigate } from "@tanstack/solid-router";

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

    await queryClient.resetQueries();
    await navigate({ to: "/sign-in" });
  };
}
