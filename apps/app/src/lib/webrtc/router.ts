/**
 * oRPC router for the mobile app.
 * Exposes procedures that the game client can call over WebRTC.
 * Currently empty - reserved for future bidirectional communication.
 */

import { os } from "@orpc/server";

/**
 * The app router that the game client can call.
 * This must match the contract defined in @tuneperfect/contracts/app.
 *
 * Currently empty, but can be extended for features like:
 * - Sending user input/actions to the game
 * - Syncing user preferences
 * - Real-time scoring feedback
 */
export const appRouter = os.router({});
