import { safe } from "@orpc/client";
import { queryOptions } from "@tanstack/solid-query";
import { lobbyStore } from "~/stores/lobby";
import { client } from "./orpc";

export const lobbyQueryOptions = () =>
  queryOptions({
    queryKey: ["lobby"],
    refetchInterval: 5000,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    queryFn: async () => {
      if (!lobbyStore.lobby()) return null;

      const [error, data] = await safe(client.lobby.currentLobby.call());

      if (error) return null;

      return data;
    },
  });

export const highscoreQueryOptions = (hash: string) =>
  queryOptions({
    queryKey: ["highscore", hash],
    queryFn: async () => {
      if (!lobbyStore.lobby()) return null;

      const [error, data] = await safe(client.highscore.getHighscores.call({ hash }));

      if (error) return null;

      return data;
    },
  });

export const availableClubsQueryOptions = () =>
  queryOptions({
    queryKey: ["availableClubs"],
    refetchInterval: 10000,
    queryFn: async () => {
      if (!lobbyStore.lobby()) return [];

      const [error, data] = await safe(client.lobby.getAvailableClubs.call());

      if (error) return [];

      return data;
    },
  });
