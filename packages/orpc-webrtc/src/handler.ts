/**
 * Server-side handler for processing incoming oRPC requests over WebRTC data channels.
 */

import type { Context } from "@orpc/server";
import type { StandardHandler } from "@orpc/server/standard";
import type { HandleStandardServerPeerMessageOptions } from "@orpc/server/standard-peer";
import { createServerPeerHandleRequestFn } from "@orpc/server/standard-peer";
import type { MaybeOptionalOptions } from "@orpc/shared";
import { isObject, resolveMaybeOptionalOptions } from "@orpc/shared";
import {
  decodeRequestMessage,
  deserializeRequestMessage,
  encodeResponseMessage,
  experimental_ServerPeerWithoutCodec as ServerPeerWithoutCodec,
  serializeResponseMessage,
} from "@orpc/standard-server-peer";
import { onDataChannelClose, onDataChannelMessage, postDataChannelMessage } from "./data-channel";

/**
 * Handler that processes incoming oRPC requests from a WebRTC data channel.
 */
export class DataChannelHandler<T extends Context> {
  constructor(private readonly standardHandler: StandardHandler<T>) {}

  /**
   * Upgrade a data channel to handle oRPC requests.
   * This channel should be dedicated to receiving requests and sending responses.
   */
  upgrade(channel: RTCDataChannel, ...rest: MaybeOptionalOptions<HandleStandardServerPeerMessageOptions<T>>): void {
    let useSerialized = false;

    const peer = new ServerPeerWithoutCodec(async (message) => {
      const [id, type, payload] = message;
      if (useSerialized) {
        const serialized = serializeResponseMessage(id, type, payload);
        postDataChannelMessage(channel, JSON.stringify(serialized));
      } else {
        const encoded = await encodeResponseMessage(id, type, payload);
        if (typeof encoded === "string") {
          postDataChannelMessage(channel, encoded);
        } else if (encoded instanceof Uint8Array) {
          postDataChannelMessage(channel, encoded.buffer as ArrayBuffer);
        } else {
          postDataChannelMessage(channel, encoded as ArrayBuffer);
        }
      }
    });

    onDataChannelMessage(channel, async (message) => {
      const handleFn = createServerPeerHandleRequestFn(this.standardHandler, resolveMaybeOptionalOptions(rest));

      let decoded;
      if (isObject(message)) {
        useSerialized = true;
        decoded = deserializeRequestMessage(message as unknown as Parameters<typeof deserializeRequestMessage>[0]);
      } else if (typeof message === "string") {
        try {
          const parsed = JSON.parse(message);
          if (isObject(parsed) && "i" in parsed && "p" in parsed) {
            useSerialized = true;
            decoded = deserializeRequestMessage(parsed as unknown as Parameters<typeof deserializeRequestMessage>[0]);
          } else {
            decoded = await decodeRequestMessage(message);
          }
        } catch {
          decoded = await decodeRequestMessage(message);
        }
      } else {
        decoded = await decodeRequestMessage(message as Parameters<typeof decodeRequestMessage>[0]);
      }

      await peer.message(decoded, handleFn);
    });

    onDataChannelClose(channel, () => {
      peer.close();
    });
  }
}
