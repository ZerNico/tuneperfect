/**
 * Contract types for the game router.
 * These types are shared so the mobile app can have type-safe RPC calls to the game.
 */

import type { ContractRouterClient, InferContractRouterOutputs } from "@orpc/contract";
import { oc } from "@orpc/contract";
import * as v from "valibot";

/**
 * Valibot schema for song summary returned to mobile apps.
 */
export const SongSummarySchema = v.object({
  hash: v.string(),
  title: v.string(),
  artist: v.string(),
});

/**
 * Type inferred from the schema.
 */
export type SongSummary = v.InferOutput<typeof SongSummarySchema>;

/**
 * Contract for listing songs.
 */
export const listSongsContract = oc.output(v.array(SongSummarySchema));

/**
 * Contract definition for the game router.
 * This defines the shape of procedures without implementation.
 */
export const gameContract = {
  songs: {
    list: listSongsContract,
  },
};

/**
 * Type of the game contract for use in type definitions.
 */
export type GameContract = typeof gameContract;

/**
 * Inferred output types for the game contract.
 */
export type GameOutputs = InferContractRouterOutputs<GameContract>;

/**
 * Client type for calling game procedures from the app.
 */
export type GameClient = ContractRouterClient<GameContract>;
