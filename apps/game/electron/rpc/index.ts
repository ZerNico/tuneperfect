import { RPCHandler } from "@orpc/server/message-port";
import { type BrowserWindow, ipcMain } from "electron";

import { RPC_CONNECT_CHANNEL } from "../../src/lib/native/channel";
import { nativeErrors, os } from "./base";
import { nativeProcedures } from "./native";
import { type PlatformDependencies, platformProcedures } from "./platform";

export function createRpcHandler(dependencies: PlatformDependencies) {
  const router = os.use(nativeErrors).router({
    ...nativeProcedures,
    ...platformProcedures(dependencies),
  });
  return new RPCHandler(router);
}

/** Serves the contract on every MessagePort a window's preload forwards. */
export function listenForRpc(
  handler: ReturnType<typeof createRpcHandler>,
  windowFor: (id: number) => BrowserWindow | null,
) {
  ipcMain.on(RPC_CONNECT_CHANNEL, (event) => {
    const [port] = event.ports;
    if (!port) return;
    handler.upgrade(port, { context: { window: windowFor(event.sender.id) } });
    port.start();
  });
}
