/**
 * @tuneperfect/orpc-webrtc
 *
 * An oRPC adapter for WebRTC data channels, enabling type-safe bidirectional
 * RPC communication over peer-to-peer connections.
 *
 * @example Server (handler) setup:
 * ```ts
 * import { RPCHandler } from '@tuneperfect/orpc-webrtc/server';
 * import { myRouter } from './router';
 *
 * const handler = new RPCHandler(myRouter);
 * handler.upgrade(dataChannel);
 * ```
 *
 * @example Client (link) setup:
 * ```ts
 * import { RPCLink } from '@tuneperfect/orpc-webrtc/client';
 * import { createORPCClient } from '@orpc/client';
 * import type { MyRouter } from './router';
 *
 * const link = new RPCLink({ channel: dataChannel });
 * const client = createORPCClient<MyRouter>(link);
 * const result = await client.myProcedure();
 * ```
 */

export * from "./client";
export * from "./data-channel";
export * from "./server";
