
import * as v from "valibot";
import type { LocalUser } from "~/lib/types";
import { createPersistentStore } from "../lib/utils/store";

const localStoreSchema = v.object({
  version: v.literal("1.0.0"),
  players: v.array(
    v.object({
      id: v.string(),
      username: v.string(),
      type: v.literal("local"),
    })
  ),
  scores: v.record(v.string(), v.record(v.string(), v.number())),
});

export type LocalStore = v.InferOutput<typeof localStoreSchema>;

const defaultLocalSettings: LocalStore = {
  version: "1.0.0",
  players: [],
  scores: {},
};

const localStoreInstance = createPersistentStore({
  filename: "local.json",
  schema: localStoreSchema,
  defaults: defaultLocalSettings, 
});

export const localSettings = localStoreInstance.settings;
export const setLocalSettings = localStoreInstance.setSettings;
export const updateLocalSettings = localStoreInstance.updateSettings;
export const initializeLocalSettings = localStoreInstance.initialize;

function createLocalStore() {
  const generateId = () => {
    return crypto.randomUUID();
  };

  const addPlayer = (username: string) => {
    const newPlayer: LocalUser = {
      id: generateId(),
      username: username.trim(),
      type: "local",
    };

    updateLocalSettings("players", (prev) => [...prev, newPlayer]);
    return newPlayer;
  };

  const updatePlayer = (id: string, updates: Partial<Pick<LocalUser, "username">>) => {
    updateLocalSettings("players", (prev) => prev.map((player) => (player.id === id ? { ...player, ...updates } : player)));
  };

  const deletePlayer = (id: string) => {
    updateLocalSettings("players", (prev) => prev.filter((player) => player.id !== id));
    updateLocalSettings("scores", (prev) => {
      const newScores = { ...prev };
      delete newScores[id];
      return newScores;
    });
  };

  const getPlayer = (id: string) => {
    return localSettings().players.find((player) => player.id === id) || null;
  };

  const addScore = (userId: string, songHash: string, score: number) => {
    updateLocalSettings("scores", (prev) => {
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
    return localSettings().scores[userId]?.[songHash] || 0;
  };

  const getScoresForSong = (songHash: string) => {
    const currentScores = localSettings().scores;
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
    players: () => localSettings().players,
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
