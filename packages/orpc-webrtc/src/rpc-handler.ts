/**
 * Convenience RPC handler that combines a router with the DataChannelHandler.
 * Similar to @orpc/server/message-port RPCHandler.
 */

import type { Context, Router } from "@orpc/server";
import type { StandardRPCHandlerOptions } from "@orpc/server/standard";
import { StandardRPCHandler } from "@orpc/server/standard";
import { DataChannelHandler } from "./handler";

export interface RPCHandlerOptions<T extends Context> extends StandardRPCHandlerOptions<T> {}

/**
 * RPC Handler for WebRTC data channels.
 * Combines a router with the data channel handler for easy setup.
 */
export class RPCHandler<T extends Context> extends DataChannelHandler<T> {
  constructor(router: Router<any, T>, options: NoInfer<RPCHandlerOptions<T>> = {}) {
    super(new StandardRPCHandler(router, options));
  }
}
