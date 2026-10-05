import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { Client } from "@tuneperfect/api";
import { joinURL } from "ufo";
import * as v from "valibot";

import { createPersistentStore } from "~/lib/utils/store";

import { localStore } from "./local";

const lobbyDataSchema = v.object({
  token: v.string(),
  lobby: v.object({
    id: v.string(),
  }),
  createdAt: v.number(),
});

const lobbyStoreSchema = v.object({
  version: v.literal("1.0.0"),
  data: v.nullable(lobbyDataSchema),
  localPlayerIds: v.optional(v.array(v.string()), []),
});

type LobbyStore = v.InferOutput<typeof lobbyStoreSchema>;
type LobbyData = v.InferOutput<typeof lobbyDataSchema>;

const defaultLobbySettings: LobbyStore = {
  version: "1.0.0",
  data: null,
  localPlayerIds: [],
};

const lobbyStoreInstance = createPersistentStore({
  filename: "lobby.json",
  schema: lobbyStoreSchema,
  defaults: defaultLobbySettings,
});

const deleteLobby = (token: string) => {
  const link = new RPCLink({
    url: joinURL(import.meta.env.VITE_API_URL ?? "", "/rpc"),
    headers: { Authorization: `Bearer ${token}` },
  });
  const api: Client = createORPCClient(link);
  return api.lobby.deleteLobby();
};

function createLobbyStore() {
  // Persisted alongside the lobby so local players survive an app restart while the lobby exists.
  const localPlayerIds = () => lobbyStoreInstance.settings().localPlayerIds;
  const setLocalPlayerIds = (ids: string[]) => lobbyStoreInstance.updateSettings("localPlayerIds", ids);

  const lobby = () => {
    return lobbyStoreInstance.settings().data;
  };

  const setLobby = (newLobby: LobbyData | undefined) => {
    lobbyStoreInstance.updateSettings("data", newLobby || null);
  };

  // Clears the local state synchronously, so a lobby created right afterwards can't be wiped by a late clear,
  // then deletes the old lobby in the background with its own token (the shared client reads the token lazily).
  const clearLobby = () => {
    const current = lobby();
    if (!current) {
      return;
    }

    setLobby(undefined);
    setLocalPlayerIds([]);
    deleteLobby(current.token).catch(() => {});
  };

  const addLocalPlayer = (playerId: string) => {
    const currentIds = localPlayerIds();
    if (!currentIds.includes(playerId)) {
      setLocalPlayerIds([...currentIds, playerId]);
    }
  };

  const removeLocalPlayer = (playerId: string) => {
    const currentIds = localPlayerIds();
    setLocalPlayerIds(currentIds.filter((id) => id !== playerId));
  };

  const localPlayersInLobby = () => {
    return localPlayerIds()
      .map((id) => localStore.getPlayer(id))
      .filter((player): player is NonNullable<typeof player> => player !== null);
  };

  return {
    lobby,
    setLobby,
    clearLobby,
    localPlayerIds,
    setLocalPlayerIds,
    addLocalPlayer,
    removeLocalPlayer,
    localPlayersInLobby,
  };
}

export const lobbyStore = createLobbyStore();
export const initializeLobbySettings = lobbyStoreInstance.initialize;
