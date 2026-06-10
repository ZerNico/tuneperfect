import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { call } from "@orpc/server";

import { authedContext, expectORPCError, makeUser } from "../../test/helpers";
import type { User } from "../types";
import { clubRouter } from "./router";
import { clubService } from "./service";

afterEach(() => {
  mock.restore();
});

const CLUB_ID = "11111111-0000-4000-8000-000000000001";

type Role = "owner" | "admin" | "member";

function makeMember(user: User, role: Role) {
  return {
    clubId: CLUB_ID,
    userId: user.id,
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    user,
  };
}

/** A club with one owner, one admin and one member, plus a non-member outsider. */
function makeClub() {
  const owner = makeUser({ username: "owner" });
  const admin = makeUser({ username: "admin" });
  const member = makeUser({ username: "member" });
  const outsider = makeUser({ username: "outsider" });

  const club = {
    id: CLUB_ID,
    name: "Test Club",
    createdAt: new Date(),
    updatedAt: new Date(),
    members: [makeMember(owner, "owner"), makeMember(admin, "admin"), makeMember(member, "member")],
  };

  spyOn(clubService, "getClub").mockResolvedValue(club as Awaited<ReturnType<typeof clubService.getClub>>);

  return { club, owner, admin, member, outsider };
}

describe("getClub", () => {
  it("returns the club for members", async () => {
    const { club, member } = makeClub();

    const result = await call(clubRouter.getClub, { clubId: CLUB_ID }, { context: await authedContext(member) });

    expect(result.id).toBe(club.id);
  });

  it("rejects non-members", async () => {
    const { outsider } = makeClub();

    await expectORPCError(
      call(clubRouter.getClub, { clubId: CLUB_ID }, { context: await authedContext(outsider) }),
      "FORBIDDEN",
    );
  });

  it("returns 404 for an unknown club", async () => {
    const user = makeUser();
    spyOn(clubService, "getClub").mockResolvedValue(undefined);

    await expectORPCError(
      call(clubRouter.getClub, { clubId: "unknown" }, { context: await authedContext(user) }),
      "NOT_FOUND",
    );
  });
});

describe("updateClub", () => {
  it.each<["owner" | "admin", string]>([
    ["owner", "owner"],
    ["admin", "admin"],
  ])("allows the %s to update the club", async (role) => {
    const actors = makeClub();
    const updateSpy = spyOn(clubService, "updateClub").mockResolvedValue({
      id: CLUB_ID,
      name: "Renamed",
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await call(
      clubRouter.updateClub,
      { clubId: CLUB_ID, name: "Renamed" },
      { context: await authedContext(actors[role]) },
    );

    expect(updateSpy).toHaveBeenCalledWith(CLUB_ID, { name: "Renamed" });
  });

  it.each<["member" | "outsider"]>([["member"], ["outsider"]])("rejects a %s", async (who) => {
    const actors = makeClub();
    const updateSpy = spyOn(clubService, "updateClub");

    await expectORPCError(
      call(clubRouter.updateClub, { clubId: CLUB_ID, name: "Renamed" }, { context: await authedContext(actors[who]) }),
      "FORBIDDEN",
    );
    expect(updateSpy).not.toHaveBeenCalled();
  });
});

describe("invite", () => {
  it.each<["owner" | "admin"]>([["owner"], ["admin"]])("allows the %s to invite", async (role) => {
    const actors = makeClub();
    const inviteSpy = spyOn(clubService, "inviteUserToClub").mockResolvedValue();

    await call(
      clubRouter.invite,
      { clubId: CLUB_ID, username: "newbie" },
      { context: await authedContext(actors[role]) },
    );

    expect(inviteSpy).toHaveBeenCalledWith(CLUB_ID, actors[role].id, "newbie");
  });

  it.each<["member" | "outsider"]>([["member"], ["outsider"]])("rejects a %s", async (who) => {
    const actors = makeClub();
    const inviteSpy = spyOn(clubService, "inviteUserToClub");

    await expectORPCError(
      call(clubRouter.invite, { clubId: CLUB_ID, username: "newbie" }, { context: await authedContext(actors[who]) }),
      "FORBIDDEN",
    );
    expect(inviteSpy).not.toHaveBeenCalled();
  });
});

describe("removeMember", () => {
  it("allows the owner to remove a member", async () => {
    const { owner, member } = makeClub();
    const removeSpy = spyOn(clubService, "removeMember").mockResolvedValue();

    await call(
      clubRouter.removeMember,
      { clubId: CLUB_ID, userId: member.id },
      { context: await authedContext(owner) },
    );

    expect(removeSpy).toHaveBeenCalledWith(CLUB_ID, member.id);
  });

  it.each<["admin" | "member" | "outsider"]>([["admin"], ["member"], ["outsider"]])("rejects a %s", async (who) => {
    const actors = makeClub();
    const removeSpy = spyOn(clubService, "removeMember");

    await expectORPCError(
      call(
        clubRouter.removeMember,
        { clubId: CLUB_ID, userId: actors.member.id },
        { context: await authedContext(actors[who]) },
      ),
      "FORBIDDEN",
    );
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it("never removes the owner", async () => {
    const { owner } = makeClub();
    const removeSpy = spyOn(clubService, "removeMember");

    await expectORPCError(
      call(clubRouter.removeMember, { clubId: CLUB_ID, userId: owner.id }, { context: await authedContext(owner) }),
      "FORBIDDEN",
    );
    expect(removeSpy).not.toHaveBeenCalled();
  });

  it("returns 404 when the target is not a member", async () => {
    const { owner, outsider } = makeClub();

    await expectORPCError(
      call(clubRouter.removeMember, { clubId: CLUB_ID, userId: outsider.id }, { context: await authedContext(owner) }),
      "NOT_FOUND",
    );
  });
});

describe("transferOwnership", () => {
  it("allows the owner to transfer to another member", async () => {
    const { owner, admin } = makeClub();
    const transferSpy = spyOn(clubService, "transferOwnership").mockResolvedValue();

    await call(
      clubRouter.transferOwnership,
      { clubId: CLUB_ID, userId: admin.id },
      { context: await authedContext(owner) },
    );

    expect(transferSpy).toHaveBeenCalledWith(CLUB_ID, owner.id, admin.id);
  });

  it.each<["admin" | "member" | "outsider"]>([["admin"], ["member"], ["outsider"]])("rejects a %s", async (who) => {
    const actors = makeClub();
    const transferSpy = spyOn(clubService, "transferOwnership");

    await expectORPCError(
      call(
        clubRouter.transferOwnership,
        { clubId: CLUB_ID, userId: actors.member.id },
        { context: await authedContext(actors[who]) },
      ),
      "FORBIDDEN",
    );
    expect(transferSpy).not.toHaveBeenCalled();
  });

  it("rejects transferring to yourself", async () => {
    const { owner } = makeClub();

    await expectORPCError(
      call(
        clubRouter.transferOwnership,
        { clubId: CLUB_ID, userId: owner.id },
        { context: await authedContext(owner) },
      ),
      "FORBIDDEN",
    );
  });

  it("returns 404 when the new owner is not a member", async () => {
    const { owner, outsider } = makeClub();

    await expectORPCError(
      call(
        clubRouter.transferOwnership,
        { clubId: CLUB_ID, userId: outsider.id },
        { context: await authedContext(owner) },
      ),
      "NOT_FOUND",
    );
  });
});

describe("deleteClub", () => {
  it("allows the owner to delete the club", async () => {
    const { owner } = makeClub();
    const deleteSpy = spyOn(clubService, "deleteClub").mockResolvedValue();

    await call(clubRouter.deleteClub, { clubId: CLUB_ID }, { context: await authedContext(owner) });

    expect(deleteSpy).toHaveBeenCalledWith(CLUB_ID);
  });

  it.each<["admin" | "member" | "outsider"]>([["admin"], ["member"], ["outsider"]])("rejects a %s", async (who) => {
    const actors = makeClub();
    const deleteSpy = spyOn(clubService, "deleteClub");

    await expectORPCError(
      call(clubRouter.deleteClub, { clubId: CLUB_ID }, { context: await authedContext(actors[who]) }),
      "FORBIDDEN",
    );
    expect(deleteSpy).not.toHaveBeenCalled();
  });
});

describe("changeRole", () => {
  it("allows the owner to promote a member to admin", async () => {
    const { owner, member } = makeClub();
    const changeSpy = spyOn(clubService, "changeRole").mockResolvedValue();

    await call(
      clubRouter.changeRole,
      { clubId: CLUB_ID, userId: member.id, role: "admin" },
      { context: await authedContext(owner) },
    );

    expect(changeSpy).toHaveBeenCalledWith(CLUB_ID, member.id, "admin");
  });

  it.each<["admin" | "member" | "outsider"]>([["admin"], ["member"], ["outsider"]])("rejects a %s", async (who) => {
    const actors = makeClub();
    const changeSpy = spyOn(clubService, "changeRole");

    await expectORPCError(
      call(
        clubRouter.changeRole,
        { clubId: CLUB_ID, userId: actors.member.id, role: "admin" },
        { context: await authedContext(actors[who]) },
      ),
      "FORBIDDEN",
    );
    expect(changeSpy).not.toHaveBeenCalled();
  });

  it("never demotes the owner", async () => {
    const { owner } = makeClub();
    const changeSpy = spyOn(clubService, "changeRole");

    await expectORPCError(
      call(
        clubRouter.changeRole,
        { clubId: CLUB_ID, userId: owner.id, role: "member" },
        { context: await authedContext(owner) },
      ),
      "FORBIDDEN",
    );
    expect(changeSpy).not.toHaveBeenCalled();
  });

  it("rejects assigning the owner role via input validation", async () => {
    const { owner, member } = makeClub();

    await expectORPCError(
      call(
        clubRouter.changeRole,
        // @ts-expect-error -- deliberately invalid role to exercise input validation
        { clubId: CLUB_ID, userId: member.id, role: "owner" },
        { context: await authedContext(owner) },
      ),
      "BAD_REQUEST",
    );
  });

  it("returns 404 when the target is not a member", async () => {
    const { owner, outsider } = makeClub();

    await expectORPCError(
      call(
        clubRouter.changeRole,
        { clubId: CLUB_ID, userId: outsider.id, role: "admin" },
        { context: await authedContext(owner) },
      ),
      "NOT_FOUND",
    );
  });
});
