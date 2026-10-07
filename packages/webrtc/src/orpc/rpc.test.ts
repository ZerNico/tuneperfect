import { describe, expect, it } from "bun:test";

import { createORPCClient } from "@orpc/client";
import { eventIterator, oc } from "@orpc/contract";
import type { ContractRouterClient } from "@orpc/contract";
import { implement } from "@orpc/server";
import * as v from "valibot";

import { RPCHandler } from "./rpc-handler";
import { RPCLink } from "./rpc-link";

/** Two ends of a data channel: what one sends, the other receives (on a later task, like the real one). */
function channelPair() {
  const end = () => new EventTarget() as EventTarget & { send: (data: unknown) => void };
  const a = end();
  const b = end();
  const wire = (from: typeof a, to: typeof b) => {
    from.send = (data) => setTimeout(() => to.dispatchEvent(new MessageEvent("message", { data })));
  };
  wire(a, b);
  wire(b, a);
  return [a, b] as unknown as [RTCDataChannel, RTCDataChannel];
}

const contract = {
  echo: oc.input(v.string()).output(v.string()),
  count: oc.input(v.number()).output(eventIterator(v.number())),
  forever: oc.output(eventIterator(v.number())),
};

function setup() {
  const os = implement(contract);
  const stopped = { forever: false };
  const router = os.router({
    echo: os.echo.handler(({ input }) => input),
    count: os.count.handler(async function* ({ input }) {
      for (let i = 1; i <= input; i++) yield i;
    }),
    forever: os.forever.handler(async function* () {
      try {
        for (let i = 0; ; i++) {
          yield i;
          await new Promise((resolve) => setTimeout(resolve, 5));
        }
      } finally {
        stopped.forever = true;
      }
    }),
  });

  const [phone, game] = channelPair();
  new RPCHandler(router).upgrade(game);
  const client = createORPCClient(new RPCLink({ channel: phone })) as ContractRouterClient<typeof contract>;
  return { client, stopped };
}

describe("oRPC over a data channel", () => {
  it("answers a plain call", async () => {
    const { client } = setup();
    expect(await client.echo("hi")).toBe("hi");
  });

  it("streams an event iterator's values to the end", async () => {
    const { client } = setup();
    const values: number[] = [];
    for await (const value of await client.count(3)) values.push(value);
    expect(values).toEqual([1, 2, 3]);
  });

  it("answers other calls while a stream is open", async () => {
    const { client } = setup();
    const stream = await client.forever();
    const first = await stream.next();
    expect(first.value).toBe(0);
    expect(await client.echo("still here")).toBe("still here");
    await stream.return(undefined);
  });

  it("stops the game's iterator when the phone stops listening", async () => {
    const { client, stopped } = setup();
    const controller = new AbortController();
    const stream = await client.forever(undefined, { signal: controller.signal });
    await stream.next();
    controller.abort();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(stopped.forever).toBe(true);
  });
});
