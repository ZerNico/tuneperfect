import { queryOptions } from "@tanstack/solid-query";
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
