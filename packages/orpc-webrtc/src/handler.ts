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
 * Determines if a message uses the serialized format.
 */
function isSerializedFormat(message: unknown): boolean {
  if (isObject(message) && "i" in message && "p" in message) {
    return true;
  }
  if (typeof message === "string") {
    try {
      const parsed = JSON.parse(message);
      return isObject(parsed) && "i" in parsed && "p" in parsed;
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Handler that processes incoming oRPC requests from a WebRTC data channel.
 */
export class DataChannelHandler<T extends Context> {
  constructor(private readonly standardHandler: StandardHandler<T>) {}

  /**
   * Upgrade a data channel to handle oRPC requests.
   * This channel should be dedicated to receiving requests and sending responses.
   * @returns A cleanup function to remove event listeners and close the peer.
   */
  upgrade(
    channel: RTCDataChannel,
    ...rest: MaybeOptionalOptions<HandleStandardServerPeerMessageOptions<T>>
  ): () => void {
    // Track format per request ID to avoid race conditions
    // Using string keys since request IDs may be strings or numbers depending on oRPC version
    const requestFormats = new Map<string, boolean>();

    const peer = new ServerPeerWithoutCodec(async (message) => {
      const [id, type, payload] = message;
      const idKey = String(id);
      // Use the format that was determined when the request was received
      const useSerialized = requestFormats.get(idKey) ?? false;

      // Clean up the format tracking after sending response (response types end the request)
      requestFormats.delete(idKey);

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

    const cleanupMessage = onDataChannelMessage(channel, async (message) => {
      try {
        const handleFn = createServerPeerHandleRequestFn(this.standardHandler, resolveMaybeOptionalOptions(rest));

        // Determine format for this specific message
        const useSerialized = isSerializedFormat(message);

        let decoded;
        if (isObject(message)) {
          decoded = deserializeRequestMessage(message as unknown as Parameters<typeof deserializeRequestMessage>[0]);
        } else if (typeof message === "string") {
          if (useSerialized) {
            const parsed = JSON.parse(message);
            decoded = deserializeRequestMessage(parsed as unknown as Parameters<typeof deserializeRequestMessage>[0]);
          } else {
            decoded = await decodeRequestMessage(message);
          }
        } else {
          decoded = await decodeRequestMessage(message as Parameters<typeof decodeRequestMessage>[0]);
        }

        // Store the format for this request ID so the response uses the same format
        const [requestId] = decoded;
        requestFormats.set(String(requestId), useSerialized);

        await peer.message(decoded, handleFn);
      } catch (error) {
        console.error("[DataChannelHandler] Error processing message:", error);
      }
    });

    const cleanupClose = onDataChannelClose(channel, () => {
      peer.close();
      requestFormats.clear();
    });

    // Return cleanup function
    return () => {
      cleanupMessage();
      cleanupClose();
      peer.close();
      requestFormats.clear();
    };
  }
}
