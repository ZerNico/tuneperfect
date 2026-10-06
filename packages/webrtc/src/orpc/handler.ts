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

export type DataChannelHandlerErrorCallback = (error: Error, requestId?: string | number) => void;

type SerializedRequest = Parameters<typeof deserializeRequestMessage>[0];

/** Our own clients send oRPC's serialized form as JSON (see link-client.ts); anything else is decoded as oRPC's encoded form. */
function asSerializedRequest(message: unknown): SerializedRequest | null {
  let value = message;
  if (typeof message === "string") {
    try {
      value = JSON.parse(message);
    } catch {
      return null;
    }
  }
  return isObject(value) && "i" in value && "p" in value ? (value as unknown as SerializedRequest) : null;
}

export type DataChannelHandlerUpgradeOptions<T extends Context> = HandleStandardServerPeerMessageOptions<T> & {
  onError?: DataChannelHandlerErrorCallback;
};

export class DataChannelHandler<T extends Context> {
  constructor(private readonly standardHandler: StandardHandler<T>) {}

  upgrade(channel: RTCDataChannel, ...rest: MaybeOptionalOptions<DataChannelHandlerUpgradeOptions<T>>): () => void {
    const options = resolveMaybeOptionalOptions(rest);
    const onError = options.onError ?? ((error: Error) => console.error("[DataChannelHandler] Error:", error));

    // Track format per request ID so response uses same format as request
    const requestFormats = new Map<string, boolean>();

    const peer = new ServerPeerWithoutCodec(async (message) => {
      const [id, type, payload] = message;
      const idKey = String(id);
      const useSerialized = requestFormats.get(idKey) ?? false;
      requestFormats.delete(idKey);

      if (useSerialized) {
        postDataChannelMessage(channel, JSON.stringify(serializeResponseMessage(id, type, payload)));
      } else {
        const encoded = await encodeResponseMessage(id, type, payload);
        postDataChannelMessage(
          channel,
          typeof encoded === "string"
            ? encoded
            : // A view may not start at its buffer's beginning; send exactly its bytes.
              (new Uint8Array(encoded as ArrayBuffer).slice().buffer as ArrayBuffer),
        );
      }
    });

    const cleanupMessage = onDataChannelMessage(channel, async (message) => {
      let requestId: string | number | undefined;
      try {
        const handleFn = createServerPeerHandleRequestFn(this.standardHandler, options);
        const serialized = asSerializedRequest(message);
        const useSerialized = serialized !== null;
        const decoded = serialized
          ? deserializeRequestMessage(serialized)
          : await decodeRequestMessage(message as Parameters<typeof decodeRequestMessage>[0]);

        requestId = decoded[0];
        requestFormats.set(String(requestId), useSerialized);

        await peer.message(decoded, handleFn);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        onError(error, requestId);
      }
    });

    const cleanupClose = onDataChannelClose(channel, () => {
      peer.close();
      requestFormats.clear();
    });

    return () => {
      cleanupMessage();
      cleanupClose();
      peer.close();
      requestFormats.clear();
    };
  }
}
