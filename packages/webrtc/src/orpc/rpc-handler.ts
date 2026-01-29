import type { Context, Router } from "@orpc/server";
import type { StandardRPCHandlerOptions } from "@orpc/server/standard";
import { StandardRPCHandler } from "@orpc/server/standard";
import { DataChannelHandler } from "./handler";

export interface RPCHandlerOptions<T extends Context> extends StandardRPCHandlerOptions<T> {}

export class RPCHandler<T extends Context> extends DataChannelHandler<T> {
  // biome-ignore lint/suspicious/noExplicitAny: Router type requires any for contract compatibility
  constructor(router: Router<any, T>, options: NoInfer<RPCHandlerOptions<T>> = {}) {
    super(new StandardRPCHandler(router, options));
  }
}
