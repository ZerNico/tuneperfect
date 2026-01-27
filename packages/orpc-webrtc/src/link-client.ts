/**
 * Client for sending oRPC requests over a WebRTC data channel.
 */

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

export interface LinkDataChannelClientOptions {
  /**
   * The RTCDataChannel to use for communication.
   * This channel should be dedicated to sending requests and receiving responses.
   */
  channel: RTCDataChannel;
}

/**
 * oRPC client that sends requests over a WebRTC data channel.
 */
export class LinkDataChannelClient<T extends ClientContext> implements StandardLinkClient<T> {
  private readonly peer: ClientPeerWithoutCodec;

  constructor(options: LinkDataChannelClientOptions) {
    this.peer = new ClientPeerWithoutCodec(async (message) => {
      const [id, type, payload] = message;
      const serialized = serializeRequestMessage(id, type, payload);
      postDataChannelMessage(options.channel, JSON.stringify(serialized));
    });

    onDataChannelMessage(options.channel, async (message: unknown) => {
      let decoded;
      if (isObject(message)) {
        decoded = deserializeResponseMessage(message as unknown as Parameters<typeof deserializeResponseMessage>[0]);
      } else if (typeof message === "string") {
        try {
          const parsed = JSON.parse(message);
          if (isObject(parsed) && "i" in parsed) {
            decoded = deserializeResponseMessage(parsed as unknown as Parameters<typeof deserializeResponseMessage>[0]);
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
    });

    onDataChannelClose(options.channel, () => {
      this.peer.close();
    });
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
