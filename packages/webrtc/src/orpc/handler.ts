import type { Context } from "@orpc/server";
import type { StandardHandler } from "@orpc/server/standard";
import type { HandleStandardServerPeerMessageOptions } from "@orpc/server/standard-peer";
import { createServerPeerHandleRequestFn } from "@orpc/server/standard-peer";
import type { MaybeOptionalOptions } from "@orpc/shared";
import { isAsyncIteratorObject, isObject, resolveMaybeOptionalOptions } from "@orpc/shared";
import type { StandardResponse } from "@orpc/standard-server";
import {
  decodeRequestMessage,
  deserializeRequestMessage,
  encodeResponseMessage,
  experimental_ServerPeerWithoutCodec as ServerPeerWithoutCodec,
  MessageType,
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

type ServerMessage = Parameters<ConstructorParameters<typeof ServerPeerWithoutCodec>[0]>[0];

/**
 * The client only reads a response as a stream when it says so (as `encodeResponseMessage` does
 * for the encoded form); the serialized form doesn't, and would send the iterator as `{}`.
 */
function withStreamHeaders(type: ServerMessage[1], payload: ServerMessage[2]) {
  if (type !== MessageType.RESPONSE) return payload;
  const response = payload as StandardResponse;
  if (!isAsyncIteratorObject(response.body)) return payload;
  return { ...response, headers: { ...response.headers, "content-type": "text/event-stream" }, body: undefined };
}

/** Whether nothing more is sent for this request after this message. */
function isLastMessage(type: ServerMessage[1], payload: ServerMessage[2]) {
  if (type === MessageType.RESPONSE) return !isAsyncIteratorObject((payload as StandardResponse).body);
  if (type === MessageType.EVENT_ITERATOR) {
    const event = (payload as { event: string }).event;
    return event === "done" || event === "error";
  }
  return true;
}

export type DataChannelHandlerUpgradeOptions<T extends Context> = HandleStandardServerPeerMessageOptions<T> & {
  onError?: DataChannelHandlerErrorCallback;
};

export class DataChannelHandler<T extends Context> {
  constructor(private readonly standardHandler: StandardHandler<T>) {}

  upgrade(channel: RTCDataChannel, ...rest: MaybeOptionalOptions<DataChannelHandlerUpgradeOptions<T>>): () => void {
    const options = resolveMaybeOptionalOptions(rest);
    const onError = options.onError ?? ((error: Error) => console.error("[DataChannelHandler] Error:", error));

    // Replies use the format of their request. A stream's events come after its response, so a
    // request's format is kept until its last message: the response of a plain call, the end of a
    // stream, or the client aborting.
    const requestFormats = new Map<string, boolean>();

    const peer = new ServerPeerWithoutCodec(async (message) => {
      const [id, type, payload] = message;
      const idKey = String(id);
      const useSerialized = requestFormats.get(idKey) ?? false;
      if (isLastMessage(type, payload)) requestFormats.delete(idKey);

      if (useSerialized) {
        postDataChannelMessage(
          channel,
          JSON.stringify(serializeResponseMessage(id, type, withStreamHeaders(type, payload))),
        );
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
        // Only a request opens a format; a client's abort ends it (nothing more is sent after it).
        if (decoded[1] === MessageType.REQUEST) requestFormats.set(String(requestId), useSerialized);
        else if (decoded[1] === MessageType.ABORT_SIGNAL) requestFormats.delete(String(requestId));

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
