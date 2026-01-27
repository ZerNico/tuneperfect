/**
 * Contract types for the app router.
 * These types are shared so the game can have type-safe RPC calls to the app.
 */

import type { RouterClient } from "@orpc/server";
import { os } from "@orpc/server";

/**
 * Contract definition for the app router.
 * Currently empty - reserved for future bidirectional communication.
 *
 * Potential future procedures:
 * - Sending user input/actions to the game
 * - Syncing user preferences
 * - Real-time scoring feedback
 */
export const appContract = os.router({});

/**
 * Type of the app router for use in client type definitions.
 */
export type AppRouter = typeof appContract;

/**
 * Client type for calling app procedures from the game.
 */
export type AppClient = RouterClient<AppRouter>;
