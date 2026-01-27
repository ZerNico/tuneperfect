/**
 * oRPC router for the game client.
 * Exposes procedures that mobile apps can call over WebRTC.
 */

import { implement } from "@orpc/server";
import { gameContract, type SongSummary } from "@tuneperfect/contracts/game";
import { songsStore } from "../../stores/songs";

/**
 * Create the implementer from the contract.
 */
const os = implement(gameContract);

/**
 * The game router that mobile apps can call.
 * This implements the contract defined in @tuneperfect/contracts/game.
 */
export const gameRouter = os.router({
  songs: {
    /**
     * Get the list of all available songs.
     */
    list: os.songs.list.handler(async (): Promise<SongSummary[]> => {
      return songsStore.songs().map((song) => ({
        hash: song.hash,
        title: song.title,
        artist: song.artist,
      }));
    }),
  },
});
