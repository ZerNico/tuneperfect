import { RPCHandler } from "@orpc/server/message-port";
import { type BrowserWindow, ipcMain } from "electron";

import { RPC_CONNECT_CHANNEL } from "../../src/lib/native/channel";
import { nativeErrors, os } from "./base";
import { nativeProcedures } from "./native";
import { type PlatformDependencies, platformProcedures } from "./platform";

/** `MessageType.EVENT_ITERATOR` of oRPC's message-port protocol (`@orpc/standard-server-peer`). */
const EVENT_ITERATOR_MESSAGE = 3;

export function createRpcHandler(dependencies: PlatformDependencies) {
  const router = os.use(nativeErrors).router({
    ...nativeProcedures,
    ...platformProcedures(dependencies),
  });
  // Stream events are posted as structured clones instead of JSON text, so the library's packed
  // notes (in the song parse's last event) stay one binary buffer: as JSON, a big library doesn't
  // even fit in a string. Other replies stay JSON: oRPC only marks a reply as a stream when it
  // encodes it. Nothing is transferred; Electron's main-process ports can only transfer ports.
  return new RPCHandler(router, {
    experimental_transfer: ([, type]) => (type === EVENT_ITERATOR_MESSAGE ? [] : null),
  });
}

/** Serves the contract on every MessagePort a window's preload forwards. */
export function listenForRpc(
  handler: ReturnType<typeof createRpcHandler>,
  appOrigin: string,
  windowFor: (id: number) => BrowserWindow | null,
) {
  ipcMain.on(RPC_CONNECT_CHANNEL, (event) => {
    // Only the app's own top-level page may connect.
    const frame = event.senderFrame;
    if (!frame || frame.parent || URL.parse(frame.url)?.origin !== appOrigin) return;

    const [port] = event.ports;
    if (!port) return;
    handler.upgrade(port, { context: { window: windowFor(event.sender.id) } });
    port.start();
  });
}
