import { queryOptions } from "@tanstack/solid-query";
import { authClient } from "./auth";
import { AuthError } from "./error";
import { trpc } from "./trpc";

export function sessionQueryOptions() {
  return queryOptions({
    queryKey: ["api/v1", "auth", "session"],
    queryFn: async () => {
      const { data, error } = await authClient.getSession();

      if (error) {
        throw new AuthError(error);
      }

      return data?.user ?? null;
    },
  });
}

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

export function highscoresQueryOptions(hash: string) {
  return queryOptions({
    queryKey: ["trpc", "highscores", hash],
    queryFn: async () => {
      if (!hash) {
        return [];
      }

      return await trpc.highscore.getHighscores.query({ hash });
    },
  });
}
