/**
 * Contract types for the app router.
 * These types are shared so the game can have type-safe RPC calls to the app.
 */

import type { ContractRouterClient, InferContractRouterOutputs } from "@orpc/contract";

/**
 * Contract definition for the app router.
 * Currently empty - reserved for future bidirectional communication.
 *
 * Potential future procedures:
 * - Sending user input/actions to the game
 * - Syncing user preferences
 * - Real-time scoring feedback
 */
export const appContract = {};

/**
 * Type of the app contract for use in type definitions.
 */
export type AppContract = typeof appContract;

/**
 * Inferred output types for the app contract.
 */
export type AppOutputs = InferContractRouterOutputs<AppContract>;

/**
 * Client type for calling app procedures from the game.
 */
export type AppClient = ContractRouterClient<AppContract>;
