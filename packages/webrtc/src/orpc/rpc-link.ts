import type { ClientContext } from "@orpc/client";
import type { StandardRPCLinkOptions } from "@orpc/client/standard";
import { StandardRPCLink } from "@orpc/client/standard";
import { LinkDataChannelClient, type LinkDataChannelClientOptions } from "./link-client";

export interface RPCLinkOptions<T extends ClientContext>
  extends Omit<StandardRPCLinkOptions<T>, "url" | "method" | "fallbackMethod" | "maxUrlLength">,
    LinkDataChannelClientOptions {}

export class RPCLink<T extends ClientContext> extends StandardRPCLink<T> {
  private readonly linkClient: LinkDataChannelClient<T>;

  constructor(options: RPCLinkOptions<T>) {
    const linkClient = new LinkDataChannelClient(options);
    super(linkClient, { ...options, url: "webrtc://orpc" });
    this.linkClient = linkClient;
  }

  close() {
    this.linkClient.close();
  }
}
