import { afterEach, beforeEach, describe, expect, it, mock, setSystemTime, spyOn } from "bun:test";
import { createHmac } from "node:crypto";

import { call } from "@orpc/server";

import { authedContext, expectORPCError, lobbyContext, makeUser } from "../../test/helpers";
import { env } from "../config/env";
import { lobbyService } from "../lobby/service";
import { userService } from "../user/service";
import { webrtcRouter } from "./router";

const anonymous = { cookies: new Bun.CookieMap(), headers: new Headers(), resHeaders: new Headers() };
const original = {
  TURN_URLS: env.TURN_URLS,
  TURN_SECRET: env.TURN_SECRET,
  TURN_CREDENTIAL_TTL: env.TURN_CREDENTIAL_TTL,
};

const member = makeUser({ lobbyId: "LOBBY123" });

/** By default: lobby LOBBY123 exists with one signed-in phone in it, and every user is in it. */
function stubLobby(users: { id: string }[] = [{ id: member.id }]) {
  return spyOn(lobbyService, "getLobbyById").mockImplementation(async (id) =>
    id === "LOBBY123" ? ({ id, users } as unknown as Awaited<ReturnType<typeof lobbyService.getLobbyById>>) : undefined,
  );
}

beforeEach(() => {
  stubLobby();
  spyOn(userService, "getUserById").mockImplementation(async (id) => makeUser({ id, lobbyId: "LOBBY123" }));
});

afterEach(() => {
  mock.restore();
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
    for (const context of [await lobbyContext("LOBBY123"), await authedContext(member)]) {
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

  it("keeps one opaque id per lobby or account, so coturn's quotas count across refetches", async () => {
    const id = (username: unknown) => String(username).split(":")[1];
    const game = await lobbyContext("LOBBY123");
    const [, first] = await call(webrtcRouter.getIceServers, undefined, { context: game });
    const [, second] = await call(webrtcRouter.getIceServers, undefined, { context: game });
    const [, phone] = await call(webrtcRouter.getIceServers, undefined, { context: await authedContext(member) });
    expect(id(first?.username)).toBe(id(second?.username));
    expect(id(phone?.username)).not.toBe(id(first?.username));
    expect(id(first?.username)).toMatch(/^[0-9a-f]{16}$/);
    expect(String(first?.username)).not.toContain("LOBBY123");
  });

  it("only gives a game TURN once a signed-in phone joined its lobby", async () => {
    const stun = [{ urls: env.STUN_URL }];
    stubLobby([]);
    expect(await call(webrtcRouter.getIceServers, undefined, { context: await lobbyContext("LOBBY123") })).toEqual(
      stun,
    );
    // A token for a lobby that's gone.
    expect(await call(webrtcRouter.getIceServers, undefined, { context: await lobbyContext("GONE") })).toEqual(stun);
  });

  it("only gives a phone TURN while it's in a lobby", async () => {
    const outsider = makeUser({ lobbyId: null });
    spyOn(userService, "getUserById").mockResolvedValue(outsider);
    expect(await call(webrtcRouter.getIceServers, undefined, { context: await authedContext(outsider) })).toEqual([
      { urls: env.STUN_URL },
    ]);
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
