import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { call } from "@orpc/server";

import { authedContext, expectORPCError, lobbyContext, makeUser } from "../../test/helpers";
import { lobbyService } from "../lobby/service";
import { userService } from "../user/service";
import { signalingPublisher } from "./publisher";
import { signalingRouter } from "./router";

afterEach(() => {
  mock.restore();
});

const LOBBY_ID = "LOBBY123";

function makeLobby(userIds: string[]) {
  return {
    id: LOBBY_ID,
    users: userIds.map((id) => ({ id })),
  } as unknown as Awaited<ReturnType<typeof lobbyService.getLobbyById>>;
}

const offer = { type: "offer" as const, sdp: "v=0", from: "ignored" };

describe("sendSignal as host (lobby token)", () => {
  it("requires a target user id", async () => {
    await expectORPCError(
      call(signalingRouter.sendSignal, { signal: offer }, { context: await lobbyContext(LOBBY_ID) }),
      "BAD_REQUEST",
    );
  });

  it("rejects pushing to a user outside the lobby", async () => {
    const member = makeUser();
    spyOn(lobbyService, "getLobbyById").mockResolvedValue(makeLobby([member.id]));
    const publishSpy = spyOn(signalingPublisher, "publish");

    await expectORPCError(
      call(
        signalingRouter.sendSignal,
        { signal: offer, to: "outsider-user-id" },
        { context: await lobbyContext(LOBBY_ID) },
      ),
      "FORBIDDEN",
    );
    expect(publishSpy).not.toHaveBeenCalled();
  });

  it("publishes to the target guest channel when the target is a member", async () => {
    const member = makeUser();
    spyOn(lobbyService, "getLobbyById").mockResolvedValue(makeLobby([member.id]));
    const publishSpy = spyOn(signalingPublisher, "publish").mockReturnValue(undefined);

    await call(signalingRouter.sendSignal, { signal: offer, to: member.id }, { context: await lobbyContext(LOBBY_ID) });

    expect(publishSpy).toHaveBeenCalledWith(`lobby:${LOBBY_ID}:guest:${member.id}`, offer);
  });
});

describe("sendSignal as guest (access token)", () => {
  it("rejects a guest that is not in a lobby", async () => {
    const user = makeUser({ lobbyId: null });
    spyOn(userService, "getUserById").mockResolvedValue(user);
    const publishSpy = spyOn(signalingPublisher, "publish");

    await expectORPCError(
      call(signalingRouter.sendSignal, { signal: offer }, { context: await authedContext(user) }),
      "PRECONDITION_FAILED",
    );
    expect(publishSpy).not.toHaveBeenCalled();
  });

  it("overrides signal.from with the authenticated user id to prevent spoofing", async () => {
    const user = makeUser({ lobbyId: LOBBY_ID });
    spyOn(userService, "getUserById").mockResolvedValue(user);
    const publishSpy = spyOn(signalingPublisher, "publish").mockReturnValue(undefined);

    await call(
      signalingRouter.sendSignal,
      { signal: { type: "offer", sdp: "v=0", from: "spoofed-victim-id" } },
      { context: await authedContext(user) },
    );

    expect(publishSpy).toHaveBeenCalledTimes(1);
    const [channel, published] = publishSpy.mock.calls[0] ?? [];
    expect(channel).toBe(`lobby:${LOBBY_ID}:host`);
    expect((published as { from: string }).from).toBe(user.id);
  });
});

describe("sendSignal authentication", () => {
  it("rejects requests with neither a lobby token nor an access token", async () => {
    await expectORPCError(
      call(
        signalingRouter.sendSignal,
        { signal: offer },
        { context: { cookies: new Bun.CookieMap(), headers: new Headers(), resHeaders: new Headers() } },
      ),
      "UNAUTHORIZED",
    );
  });
});
