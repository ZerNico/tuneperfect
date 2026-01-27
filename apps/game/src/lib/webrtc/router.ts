/**
 * oRPC router for the game client.
 * Exposes procedures that mobile apps can call over WebRTC.
 */

import { implement } from "@orpc/server";
import { gameContract, type SongSummary } from "@tuneperfect/contracts/game";
import { songsStore } from "../../stores/songs";

/**
 * Context provided to all game RPC handlers.
 * Contains the authenticated userId of the connected guest.
 */
export interface GameRouterContext {
  userId: string;
}

/**
 * Create the implementer from the contract with context type.
 */
const os = implement(gameContract).$context<GameRouterContext>();

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
