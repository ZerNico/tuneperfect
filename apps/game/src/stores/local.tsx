import { makePersisted } from "@solid-primitives/storage";
import { createSignal } from "solid-js";

export interface LocalUser {
  id: string;
  username: string;
}

function createLocalStore() {
  const [players, setPlayers] = makePersisted(createSignal<LocalUser[]>([]), {
    name: "localStore.players",
  });

  const generateId = () => {
    return crypto.randomUUID();
  };

  const addPlayer = (username: string) => {
    const newPlayer: LocalUser = {
      id: generateId(),
      username: username.trim(),
    };

    setPlayers((prev) => [...prev, newPlayer]);
    return newPlayer;
  };

  const updatePlayer = (id: string, updates: Partial<Pick<LocalUser, "username">>) => {
    setPlayers((prev) => prev.map((player) => (player.id === id ? { ...player, ...updates } : player)));
  };

  const deletePlayer = (id: string) => {
    setPlayers((prev) => prev.filter((player) => player.id !== id));
  };

  const getPlayer = (id: string) => {
    return players().find((player) => player.id === id) || null;
  };

  return {
    players,
    addPlayer,
    updatePlayer,
    deletePlayer,
    getPlayer,
  };
}

export const localStore = createLocalStore();
