import { makePersisted } from "@solid-primitives/storage";
import { createSignal } from "solid-js";
import { trpc } from "~/lib/trpc";

type LobbyStore = {
  token: string;
  lobby: {
    id: string;
  };
};

function createLobbyStore() {
  const [lobby, setLobby] = makePersisted(createSignal<LobbyStore | undefined>(undefined), {
    name: "lobbyStore.lobby",
  });

  const clearLobby = async () => {
    if (!lobby()) {
      return;
    }

    try {
      //await trpc.lobby.current.delete();
    } catch (_) {
    } finally {
      setLobby(undefined);
    }
  };

  return {
    lobby,
    setLobby,
    clearLobby,
  };
}

export const lobbyStore = createLobbyStore();
