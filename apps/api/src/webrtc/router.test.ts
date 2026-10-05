import { afterEach, describe, expect, it, setSystemTime } from "bun:test";
import { createHmac } from "node:crypto";

import { call } from "@orpc/server";

import { authedContext, expectORPCError, lobbyContext, makeUser } from "../../test/helpers";
import { env } from "../config/env";
import { webrtcRouter } from "./router";

const anonymous = { cookies: new Bun.CookieMap(), headers: new Headers(), resHeaders: new Headers() };
const original = {
  TURN_URLS: env.TURN_URLS,
  TURN_SECRET: env.TURN_SECRET,
  TURN_CREDENTIAL_TTL: env.TURN_CREDENTIAL_TTL,
};

afterEach(() => {
  setSystemTime();
  Object.assign(env, original);
});

describe("getIceServers", () => {
  it("refuses callers without a lobby or a session", async () => {
    await expectORPCError(call(webrtcRouter.getIceServers, undefined, { context: anonymous }), "UNAUTHORIZED");
    await expectORPCError(
      call(webrtcRouter.getIceServers, undefined, {
        context: { ...anonymous, headers: new Headers({ authorization: "Bearer not-a-token" }) },
      }),
      "UNAUTHORIZED",
    );
  });

  it("serves games and signed-in phones STUN and TURN over UDP and TCP", async () => {
    for (const context of [await lobbyContext("LOBBY123"), await authedContext(makeUser())]) {
      const servers = await call(webrtcRouter.getIceServers, undefined, { context });
      expect(servers).toEqual([
        { urls: env.STUN_URL },
        {
          urls: ["turn:turn.test.localhost:3478?transport=udp", "turn:turn.test.localhost:3478?transport=tcp"],
          username: expect.any(String),
          credential: expect.any(String),
        },
      ]);
    }
  });

  it("hands out credentials that expire after the TTL and are signed with the secret", async () => {
    setSystemTime(new Date("2026-10-05T12:00:00Z"));
    Object.assign(env, { TURN_CREDENTIAL_TTL: 7_200 });

    const [, turn] = await call(webrtcRouter.getIceServers, undefined, { context: await lobbyContext("LOBBY123") });
    const username = String(turn?.username);
    expect(Number(username.split(":")[0])).toBe(Date.parse("2026-10-05T14:00:00Z") / 1000);
    expect(turn?.credential).toBe(createHmac("sha1", "test-turn-secret").update(username).digest("base64"));
  });

  it("gives every call its own credentials", async () => {
    const context = await lobbyContext("LOBBY123");
    const [, first] = await call(webrtcRouter.getIceServers, undefined, { context });
    const [, second] = await call(webrtcRouter.getIceServers, undefined, { context });
    expect(first?.username).not.toBe(second?.username);
  });

  it("only offers STUN while TURN isn't configured", async () => {
    const context = await lobbyContext("LOBBY123");
    Object.assign(env, { TURN_SECRET: undefined });
    expect(await call(webrtcRouter.getIceServers, undefined, { context })).toEqual([{ urls: env.STUN_URL }]);
    Object.assign(env, { TURN_SECRET: "test-turn-secret", TURN_URLS: [] });
    expect(await call(webrtcRouter.getIceServers, undefined, { context })).toEqual([{ urls: env.STUN_URL }]);
  });

  it("limits how often it can be called", () => {
    expect(webrtcRouter.getIceServers["~orpc"].meta.rateLimit).toEqual({ limit: 30, windowMs: 300_000 });
  });
});
