import * as v from "valibot";

import type { LocalUser } from "~/lib/types";

import { createPersistentStore } from "../lib/utils/store";

const difficultySchema = v.picklist(["easy", "medium", "hard"]);

const localStoreSchema1_1_0 = v.object({
  version: v.literal("1.1.0"),
  players: v.array(
    v.object({
      id: v.string(),
      username: v.string(),
      image: v.optional(v.string()),
      type: v.literal("local"),
    }),
  ),
  scores: v.record(
    v.string(), // userId
    v.record(
      v.string(), // songHash
      v.record(difficultySchema, v.optional(v.number())), // difficulty -> score
    ),
  ),
  playedSongs: v.optional(
    v.record(
      v.string(), // songHash
      v.number(), // last played timestamp (ms since epoch)
    ),
    {},
  ),
});

// Migration schema from v1.0.0 to v1.1.0
const localStoreSchema1_0_0 = v.pipe(
  v.object({
    version: v.literal("1.0.0"),
    players: v.array(
      v.object({
        id: v.string(),
        username: v.string(),
        type: v.literal("local"),
      }),
    ),
    scores: v.record(v.string(), v.record(v.string(), v.number())),
  }),
  v.transform(
    (data): v.InferInput<typeof localStoreSchema1_1_0> => ({
      version: "1.1.0",
      players: data.players,
      playedSongs: {},
      scores: Object.fromEntries(
        Object.entries(data.scores).map(([userId, userScores]) => [
          userId,
          Object.fromEntries(Object.entries(userScores).map(([songHash, score]) => [songHash, { easy: score }])),
        ]),
      ),
    }),
  ),
  localStoreSchema1_1_0,
);

const localStoreSchema = v.union([localStoreSchema1_0_0, localStoreSchema1_1_0]);

const importedScoresSchema = v.object({
  players: v.array(
    v.object({
      id: v.string(),
      username: v.string(),
      image: v.optional(v.string()),
      type: v.literal("local"),
    }),
  ),
  scores: v.record(
    v.string(), // userId
    v.record(
      v.string(), // songHash
      v.record(difficultySchema, v.optional(v.number())), // difficulty -> score
    ),
  ),
});

export type LocalStore = v.InferOutput<typeof localStoreSchema>;
export type Difficulty = v.InferOutput<typeof difficultySchema>;

const defaultLocalSettings: LocalStore = {
  version: "1.1.0",
  players: [],
  scores: {},
  playedSongs: {},
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

  const updatePlayer = (id: string, updates: Partial<Pick<LocalUser, "username" | "image">>) => {
    updateLocalSettings("players", (prev) =>
      prev.map((player) => (player.id === id ? { ...player, ...updates } : player)),
    );
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

  const addScore = (userId: string, songHash: string, difficulty: Difficulty, score: number) => {
    updateLocalSettings("scores", (prev) => {
      const userScores = prev[userId] || {};
      const songScores = userScores[songHash] || {};

      const existingScore = songScores[difficulty] || 0;

      if (score > existingScore) {
        return {
          ...prev,
          [userId]: {
            ...userScores,
            [songHash]: {
              ...songScores,
              [difficulty]: score,
            },
          },
        };
      }

      return prev;
    });
  };

  const getScore = (userId: string, songHash: string, difficulty: Difficulty) => {
    return localSettings().scores[userId]?.[songHash]?.[difficulty];
  };

  const markSongPlayed = (songHash: string) => {
    updateLocalSettings("playedSongs", (prev) => ({
      ...prev,
      [songHash]: Date.now(),
    }));
  };

  const isSongPlayed = (songHash: string) => {
    return localSettings().playedSongs[songHash] !== undefined;
  };

  const getScoresForSong = (songHash: string, difficulty: Difficulty) => {
    const currentScores = localSettings().scores;
    const result: { user: LocalUser; score: number }[] = [];

    for (const [userId, userScores] of Object.entries(currentScores)) {
      const scoreData = userScores[songHash];
      const score = scoreData?.[difficulty];
      if (score !== undefined) {
        const user = getPlayer(userId);
        if (user) {
          result.push({ user, score });
        }
      }
    }

    return result;
  };

  const importScoresAndPlayers = (importedData: unknown) => {
    const result = v.safeParse(importedScoresSchema, importedData);
    if (!result.success) {
      throw new Error("Invalid import format");
    }

    const { players: importedPlayers, scores: importedScores } = result.output;
    const playerIdMap = new Map<string, string>();
    const currentPlayers = localSettings().players;

    for (const impPlayer of importedPlayers) {
      // 1. Check if same ID exists
      const existingById = currentPlayers.find((p) => p.id === impPlayer.id);
      if (existingById) {
        playerIdMap.set(impPlayer.id, existingById.id);
        if (impPlayer.image && !existingById.image) {
          updatePlayer(existingById.id, { image: impPlayer.image });
        }
        continue;
      }

      // 2. Check if same username exists case-insensitively
      const existingByName = currentPlayers.find((p) => p.username.toLowerCase() === impPlayer.username.toLowerCase());
      if (existingByName) {
        playerIdMap.set(impPlayer.id, existingByName.id);
        if (impPlayer.image && !existingByName.image) {
          updatePlayer(existingByName.id, { image: impPlayer.image });
        }
        continue;
      }

      // 3. Otherwise add as new player and keep their original ID
      const newPlayer: LocalUser = {
        id: impPlayer.id,
        username: impPlayer.username,
        image: impPlayer.image,
        type: "local",
      };
      updateLocalSettings("players", (prev) => [...prev, newPlayer]);
      playerIdMap.set(impPlayer.id, impPlayer.id);
    }

    // Step 2: Merge scores
    for (const [impUserId, songScores] of Object.entries(importedScores)) {
      const localUserId = playerIdMap.get(impUserId);
      if (!localUserId) continue;

      for (const [songHash, diffScores] of Object.entries(songScores)) {
        for (const [difficulty, score] of Object.entries(diffScores)) {
          if (score !== undefined && score !== null) {
            addScore(localUserId, songHash, difficulty as Difficulty, score);
          }
        }
      }
    }

    return importedPlayers.length;
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
    markSongPlayed,
    isSongPlayed,
    importScoresAndPlayers,
  };
}

export const localStore = createLocalStore();
