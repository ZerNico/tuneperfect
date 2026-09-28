import { createORPCClient, safe } from "@orpc/client";
import { RPCLink } from "@orpc/client/message-port";
import type { ContractRouterClient } from "@orpc/contract";

import { RPC_CONNECT_CHANNEL } from "./channel";
import type { NativeContract } from "./contract";

function connect(): ContractRouterClient<NativeContract> {
  // One end stays here, the other goes to the preload (via a message to our own window),
  // which forwards it to the main process. Calls made before the main process picks the
  // port up are queued by the port.
  const { port1, port2 } = new MessageChannel();
  window.postMessage(RPC_CONNECT_CHANNEL, window.location.origin, [port2]);
  port1.start();

  return createORPCClient(new RPCLink({ port: port1 }));
}

/** Typed client for the Electron main process and the native addon behind it. */
export const native = connect();

export { safe };
