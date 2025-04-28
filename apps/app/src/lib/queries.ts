import { queryOptions } from "@tanstack/solid-query";
import { AuthError } from "./error";
import { trpc } from "./trpc";

export function lobbyQueryOptions() {
  return queryOptions({
    refetchInterval: 5000, // 5 seconds
    queryKey: ["trpc", "lobby", "current"],
    queryFn: async () => {
      const lobby = await trpc.lobby.current.query();

      return lobby;
    },
  });
}
