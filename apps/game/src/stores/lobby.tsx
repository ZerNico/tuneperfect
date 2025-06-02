import { makePersisted } from "@solid-primitives/storage";
import { createSignal } from "solid-js";
import { t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { localStore } from "./local";

interface LobbyStore {
  token: string;
  lobby: {
    id: string;
  };
}

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
    const currentLobby = lobby();
    if (!currentLobby) return;

    if (!localPlayerIds().includes(playerId)) {
      setLocalPlayerIds([...localPlayerIds(), playerId]);
    }
  };

  const removeLocalPlayer = (playerId: string) => {
    setLocalPlayerIds(localPlayerIds().filter((id) => id !== playerId));
  };

  const localPlayersInLobby = () => {
    const localPlayers = localPlayerIds()
      .map((id) => {
        const player = localStore.getPlayer(id);
        if (!player) return null;

        return {
          ...player,
          type: "local",
        };
      })
      .filter((player): player is NonNullable<typeof player> => player !== null);

    localPlayers.push({
      id: "guest",
      username: t("common.players.guest"),
      type: "guest",
    });
    return localPlayers;
  };

  return {
    lobby,
    setLobby,
    clearLobby,
    addLocalPlayer,
    removeLocalPlayer,
    localPlayersInLobby,
  };
}

export const lobbyStore = createLobbyStore();
