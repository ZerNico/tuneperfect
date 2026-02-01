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
      let requestId: string | number | undefined;
      try {
        const handleFn = createServerPeerHandleRequestFn(this.standardHandler, options);
        const useSerialized = isSerializedFormat(message);

        let decoded: Awaited<ReturnType<typeof decodeRequestMessage>>;
        if (isObject(message)) {
          decoded = deserializeRequestMessage(message as unknown as Parameters<typeof deserializeRequestMessage>[0]);
        } else if (typeof message === "string") {
          if (useSerialized) {
            const parsed = JSON.parse(message) as Parameters<typeof deserializeRequestMessage>[0];
            decoded = deserializeRequestMessage(parsed);
          } else {
            decoded = await decodeRequestMessage(message);
          }
        } else {
          decoded = await decodeRequestMessage(message as Parameters<typeof decodeRequestMessage>[0]);
        }

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
