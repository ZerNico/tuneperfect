import { makePersisted } from "@solid-primitives/storage";
import { createSignal } from "solid-js";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import type { GuestUser } from "~/lib/types";
import { localStore } from "./local";

type LobbyStore = {
  token: string;
  lobby: {
    id: string;
  };
};

export const guestUser: GuestUser = {
  id: "guest",
  username: t("common.players.guest"),
  type: "guest",
};

function createLobbyStore() {
  const [lobby, setLobby] = makePersisted(createSignal<LobbyStore | undefined>(undefined), {
    name: "lobbyStore.lobby",
  });

  const [localPlayerIds, setLocalPlayerIds] = createSignal<string[]>([]);

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
