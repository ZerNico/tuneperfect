import { makePersisted } from "@solid-primitives/storage";
import { createSignal } from "solid-js";
import type { LocalUser } from "~/lib/types";
import { tauriStorage } from "~/lib/utils/storage";

export const storage = tauriStorage("local.json", { autoSave: true });

// Separate scores storage: userId -> songHash -> score
type LocalScores = Record<string, Record<string, number>>;

function createLocalStore() {
  const [players, setPlayers] = makePersisted(createSignal<LocalUser[]>([]), {
    name: "players",
    storage,
  });

  const [scores, setScores] = makePersisted(createSignal<LocalScores>({}), {
    name: "scores",
    storage,
  });

  const generateId = () => {
    return crypto.randomUUID();
  };

  const addPlayer = (username: string) => {
    const newPlayer: LocalUser = {
      id: generateId(),
      username: username.trim(),
      type: "local",
    };

    setPlayers((prev) => [...prev, newPlayer]);
    return newPlayer;
  };

  const updatePlayer = (id: string, updates: Partial<Pick<LocalUser, "username">>) => {
    setPlayers((prev) => prev.map((player) => (player.id === id ? { ...player, ...updates } : player)));
  };

  const deletePlayer = (id: string) => {
    setPlayers((prev) => prev.filter((player) => player.id !== id));
    setScores((prev) => {
      const newScores = { ...prev };
      delete newScores[id];
      return newScores;
    });
  };

  const getPlayer = (id: string) => {
    return players().find((player) => player.id === id) || null;
  };

  const addScore = (userId: string, songHash: string, score: number) => {
    setScores((prev) => {
      const existingScore = prev[userId]?.[songHash] || 0;

      if (score > existingScore) {
        return {
          ...prev,
          [userId]: {
            ...prev[userId],
            [songHash]: score,
          },
        };
      }

      return prev;
    });
  };

  const getScore = (userId: string, songHash: string) => {
    return scores()[userId]?.[songHash] || 0;
  };

  const getScoresForSong = (songHash: string) => {
    const currentScores = scores();
    const result: { user: LocalUser; score: number }[] = [];

    for (const [userId, userScores] of Object.entries(currentScores)) {
      const score = userScores[songHash];
      if (score !== undefined) {
        const user = getPlayer(userId);
        if (user) {
          result.push({ user, score });
        }
      }
    }

    return result;
  };

  return {
    players,
    addPlayer,
    updatePlayer,
    deletePlayer,
    getPlayer,
    addScore,
    getScore,
    getScoresForSong,
  };
}

export const localStore = createLocalStore();
