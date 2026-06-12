import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { call } from "@orpc/server";

import { expectORPCError, lobbyContext } from "../../test/helpers";
import { lobbyRouter } from "./router";
import { lobbyService } from "./service";

afterEach(() => {
  mock.restore();
});

const LOBBY_ID = "ABCD1234";
const CLUB_ID = "11111111-0000-4000-8000-000000000001";
const OTHER_CLUB_ID = "22222222-0000-4000-8000-000000000002";

function makeClub(id: string) {
  return {
    id,
    name: "Test Club",
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeUpdatedLobby(clubId: string | null) {
  return {
    id: LOBBY_ID,
    clubId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("updateSelectedClub", () => {
  it("rejects a clubId that is not in the available clubs → FORBIDDEN, updateLobbySelectedClub not called", async () => {
    spyOn(lobbyService, "getAvailableClubsForLobby").mockResolvedValue([makeClub(CLUB_ID)] as Awaited<
      ReturnType<typeof lobbyService.getAvailableClubsForLobby>
    >);
    const updateSpy = spyOn(lobbyService, "updateLobbySelectedClub");

    await expectORPCError(
      call(lobbyRouter.updateSelectedClub, { clubId: OTHER_CLUB_ID }, { context: await lobbyContext(LOBBY_ID) }),
      "FORBIDDEN",
    );

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("allows a clubId that is in the available clubs → resolves and calls updateLobbySelectedClub", async () => {
    spyOn(lobbyService, "getAvailableClubsForLobby").mockResolvedValue([makeClub(CLUB_ID)] as Awaited<
      ReturnType<typeof lobbyService.getAvailableClubsForLobby>
    >);
    const updateSpy = spyOn(lobbyService, "updateLobbySelectedClub").mockResolvedValue(
      makeUpdatedLobby(CLUB_ID) as Awaited<ReturnType<typeof lobbyService.updateLobbySelectedClub>>,
    );

    await call(lobbyRouter.updateSelectedClub, { clubId: CLUB_ID }, { context: await lobbyContext(LOBBY_ID) });

    expect(updateSpy).toHaveBeenCalledWith(LOBBY_ID, CLUB_ID);
  });

  it("allows clubId: null without checking available clubs, calls updateLobbySelectedClub with null", async () => {
    const availableSpy = spyOn(lobbyService, "getAvailableClubsForLobby");
    const updateSpy = spyOn(lobbyService, "updateLobbySelectedClub").mockResolvedValue(
      makeUpdatedLobby(null) as Awaited<ReturnType<typeof lobbyService.updateLobbySelectedClub>>,
    );

    await call(lobbyRouter.updateSelectedClub, { clubId: null }, { context: await lobbyContext(LOBBY_ID) });

    expect(availableSpy).not.toHaveBeenCalled();
    expect(updateSpy).toHaveBeenCalledWith(LOBBY_ID, null);
  });
});
