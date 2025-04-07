import { queryOptions } from "@tanstack/solid-query";
import { authClient } from "./auth";
import { AuthError } from "./error";

export function sessionQueryOptions() {
  return queryOptions({
    queryKey: ["api/v1", "auth", "session"],
    queryFn: async () => {
      const { data, error } = await authClient.getSession();

      if (error) {
        throw new AuthError(error);
      }

      return data ?? null;
    },
  });
}
