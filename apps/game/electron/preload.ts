import { contextBridge, ipcRenderer } from "electron";

import { RPC_CONNECT_CHANNEL } from "../src/lib/native/channel";

// The renderer opens the RPC connection by posting one end of a MessageChannel to itself.
// MessagePorts can't cross `contextBridge`, so the preload picks the port up from the
// window message and hands it to the main process. Only messages the page posts to its own
// window count; an iframe (like the YouTube embed) is a different source.
window.addEventListener("message", (event) => {
  if (event.source !== window || event.data !== RPC_CONNECT_CHANNEL) return;
  const [port] = event.ports;
  if (port) ipcRenderer.postMessage(RPC_CONNECT_CHANNEL, null, [port]);
});

function argument(name: string): string {
  const prefix = `--${name}=`;
  return process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length) ?? "";
}

/** Values the renderer needs synchronously. Everything else goes through the RPC contract. */
contextBridge.exposeInMainWorld("tuneperfect", {
  platform: process.platform,
  version: argument("tp-version"),
});
