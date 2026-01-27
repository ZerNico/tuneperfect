/**
 * oRPC router for the game client.
 * Exposes procedures that mobile apps can call over WebRTC.
 */

import { os } from "@orpc/server";
import type { SongSummary } from "@tuneperfect/contracts/game";
import { songsStore } from "../../stores/songs";

/**
 * The game router that mobile apps can call.
 * This must match the contract defined in @tuneperfect/contracts/game.
 */
export const gameRouter = os.router({
  songs: os.router({
    /**
     * Get the list of all available songs.
     */
    list: os.handler(async (): Promise<SongSummary[]> => {
      return songsStore.songs().map((song) => ({
        hash: song.hash,
        title: song.title,
        artist: song.artist,
      }));
    }),
  }),
});
