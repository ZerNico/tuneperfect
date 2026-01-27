/**
 * Contract types for the game router.
 * These types are shared so the mobile app can have type-safe RPC calls.
 */

import type { RouterClient } from "@orpc/server";
import { os } from "@orpc/server";

/**
 * Song summary returned to mobile apps.
 */
export interface SongSummary {
  hash: string;
  title: string;
  artist: string;
}

/**
 * Contract definition for the game router.
 * This defines the shape of procedures without implementation.
 */
export const gameContract = os.router({
  songs: os.router({
    list: os.handler(async (): Promise<SongSummary[]> => {
      throw new Error("Contract only - not implemented");
    }),
  }),
});

/**
 * Type of the game router for use in client type definitions.
 */
export type GameRouter = typeof gameContract;

/**
 * Client type for calling game procedures from the app.
 */
export type GameClient = RouterClient<GameRouter>;
