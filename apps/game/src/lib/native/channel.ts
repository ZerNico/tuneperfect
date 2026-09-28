/**
 * IPC channel the preload uses to hand the renderer's MessagePort to the main process.
 * Shared by the client (`client.ts`), the preload and the main process (`electron/rpc`).
 */
export const RPC_CONNECT_CHANNEL = "tuneperfect:connect-rpc";
