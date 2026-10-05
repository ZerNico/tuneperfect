import { queryOptions } from "@tanstack/solid-query";
import { joinURL, withQuery } from "ufo";

import { tryCatch } from "~/lib/utils/try-catch";

import { client } from "./orpc";

export function sessionQueryOptions() {
  return queryOptions({
    queryKey: ["session"],
    staleTime: 0,
    gcTime: 0,
    queryFn: async () => {
      const [_error, session] = await tryCatch(client.user.getMe.call());

      return session;
    },
  });
}

/**
 * Where the email verification link lands: sign-in, with the address filled in and a "verified" note.
 * The API only accepts links back to this app, so this stays an absolute URL on our own origin.
 */
export function emailVerifiedUrl(email: string, redirect?: string) {
  return withQuery(joinURL(window.location.origin, "/sign-in"), { verified: "1", email, redirect });
}
