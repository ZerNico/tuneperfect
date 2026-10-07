import type { ClientContext, ClientLink, ClientOptions } from "@orpc/client";
import { CONTROL_CHANNEL_FEATURE } from "@tuneperfect/webrtc/contracts/game";
import { RPCLink } from "@tuneperfect/webrtc/orpc/client";

/** The calls that take the control channel, by their first path segment. */
const CONTROL_CALLS = new Set(["ping", "remote"]);

/**
 * Calls the game over both of the phone's channels: song lists and covers over the main one, and
 * the small, urgent calls (ping, remote control) over the control channel, so a tap on the pad or
 * a heartbeat doesn't wait behind a batch of covers. The control channel is only used once the
 * game's `ping` says it serves it: older games only answer on the main one.
 */
export class GameLink implements ClientLink<ClientContext> {
  private readonly main: RPCLink<ClientContext>;
  private readonly control: RPCLink<ClientContext>;
  private controlServed = false;

  constructor(private readonly channels: { main: RTCDataChannel; control: RTCDataChannel }) {
    this.main = new RPCLink({ channel: channels.main });
    this.control = new RPCLink({ channel: channels.control });
  }

  async call(path: readonly string[], input: unknown, options: ClientOptions<ClientContext>): Promise<unknown> {
    const useControl =
      this.controlServed && CONTROL_CALLS.has(path[0] ?? "") && this.channels.control.readyState === "open";
    const output = await (useControl ? this.control : this.main).call(path, input, options);
    if (path[0] === "ping") {
      const features = (output as { features?: string[] } | null)?.features;
      this.controlServed = features?.includes(CONTROL_CHANNEL_FEATURE) ?? false;
    }
    return output;
  }

  close() {
    this.main.close();
    this.control.close();
  }
}
