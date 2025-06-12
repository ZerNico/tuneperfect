import { createSignal } from "solid-js";
import * as v from "valibot";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import type { GuestUser } from "~/lib/types";
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
});

type LobbyStore = v.InferOutput<typeof lobbyStoreSchema>;
type LobbyData = v.InferOutput<typeof lobbyDataSchema>;

const defaultLobbySettings: LobbyStore = {
  version: "1.0.0",
  data: null,
};

const lobbyStoreInstance = createPersistentStore({
  filename: "lobby.json",
  schema: lobbyStoreSchema,
  defaults: defaultLobbySettings,
});

export const guestUser: GuestUser = {
  id: "guest",
  username: t("common.players.guest"),
  type: "guest",
};

function createLobbyStore() {
  const [localPlayerIds, setLocalPlayerIds] = createSignal<string[]>([]);

  const lobby = () => {
    return lobbyStoreInstance.settings().data;
  };

  const setLobby = (newLobby: LobbyData | undefined) => {
    lobbyStoreInstance.updateSettings("data", newLobby || null);
  };

  const clearLobby = async () => {
    if (!lobby()) {
      return;
    }

    try {
      await client.lobby.deleteLobby.call();
    } catch (_) {
    } finally {
      setLobby(undefined);
    }
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
