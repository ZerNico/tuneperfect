import { safe } from "@orpc/client";
import { queryOptions } from "@tanstack/solid-query";

import { lobbyStore } from "~/stores/lobby";

import { client } from "./orpc";

export const lobbyQueryOptions = () =>
  queryOptions({
    queryKey: ["lobby", lobbyStore.lobby()?.lobby.id ?? null],
    refetchInterval: 5000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!lobbyStore.lobby()) return null;

      const [error, data] = await safe(client.lobby.currentLobby.call());

      // Throw instead of returning null: a failed refetch keeps the last known lobby, so a short
      // API hiccup doesn't empty the player list (and block party games with "not enough players").
      if (error) throw error;

      return data;
    },
  });

export const highscoreQueryOptions = (
  hash: string,
  difficulty?: "easy" | "medium" | "hard",
  options?: { enabled: boolean },
) =>
  queryOptions({
    queryKey: ["highscore", hash, difficulty],
    queryFn: async () => {
      if (!lobbyStore.lobby()) return null;

      const [error, data] = await safe(client.highscore.getHighscores.call({ hash, difficulty }));

      if (error) return null;

      return data;
    },
    ...options,
  });

export const availableClubsQueryOptions = () =>
  queryOptions({
    queryKey: ["availableClubs", lobbyStore.lobby()?.lobby.id ?? null],
    refetchInterval: 10000,
    queryFn: async () => {
      if (!lobbyStore.lobby()) return [];

      const [error, data] = await safe(client.lobby.getAvailableClubs.call());

      if (error) return [];

      return data;
    },
  });
