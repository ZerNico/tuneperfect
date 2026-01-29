import type { ClientContext, ClientOptions } from "@orpc/client";
import type { StandardLinkClient } from "@orpc/client/standard";
import { isObject } from "@orpc/shared";
import type { StandardLazyResponse, StandardRequest } from "@orpc/standard-server";
import {
  experimental_ClientPeerWithoutCodec as ClientPeerWithoutCodec,
  decodeResponseMessage,
  deserializeResponseMessage,
  serializeRequestMessage,
} from "@orpc/standard-server-peer";
import { onDataChannelClose, onDataChannelMessage, postDataChannelMessage } from "./data-channel";

export type LinkDataChannelClientErrorCallback = (error: Error) => void;

export interface LinkDataChannelClientOptions {
  channel: RTCDataChannel;
  onError?: LinkDataChannelClientErrorCallback;
}

export class LinkDataChannelClient<T extends ClientContext> implements StandardLinkClient<T> {
  private readonly peer: ClientPeerWithoutCodec;
  private readonly cleanupMessage: () => void;
  private readonly cleanupClose: () => void;
  private readonly onError: LinkDataChannelClientErrorCallback;

  constructor(options: LinkDataChannelClientOptions) {
    this.onError = options.onError ?? ((error: Error) => console.error("[LinkDataChannelClient] Error:", error));

    this.peer = new ClientPeerWithoutCodec(async (message) => {
      const [id, type, payload] = message;
      const serialized = serializeRequestMessage(id, type, payload);
      postDataChannelMessage(options.channel, JSON.stringify(serialized));
    });

    this.cleanupMessage = onDataChannelMessage(options.channel, async (message: unknown) => {
      try {
        let decoded: Awaited<ReturnType<typeof decodeResponseMessage>>;
        if (isObject(message)) {
          decoded = deserializeResponseMessage(message as unknown as Parameters<typeof deserializeResponseMessage>[0]);
        } else if (typeof message === "string") {
          try {
            const parsed = JSON.parse(message) as Record<string, unknown>;
            if (isObject(parsed) && "i" in parsed) {
              decoded = deserializeResponseMessage(
                parsed as unknown as Parameters<typeof deserializeResponseMessage>[0],
              );
            } else {
              decoded = await decodeResponseMessage(message);
            }
          } catch {
            decoded = await decodeResponseMessage(message);
          }
        } else {
          decoded = await decodeResponseMessage(message as Parameters<typeof decodeResponseMessage>[0]);
        }
        await this.peer.message(decoded);
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        this.onError(error);
      }
    });

    this.cleanupClose = onDataChannelClose(options.channel, () => {
      this.peer.close();
    });
  }

  close() {
    this.cleanupMessage();
    this.cleanupClose();
    this.peer.close();
  }

  async call(
    request: StandardRequest,
    _options: ClientOptions<T>,
    _path: readonly string[],
    _input: unknown,
  ): Promise<StandardLazyResponse> {
    const response = await this.peer.request(request);
    return { ...response, body: () => Promise.resolve(response.body) };
  }
}
