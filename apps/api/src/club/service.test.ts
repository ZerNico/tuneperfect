import { afterEach, describe, expect, it, type Mock, mock } from "bun:test";

import { db } from "../lib/db";
import { clubService } from "./service";

// The shared mockDb (from test/setup.ts) exposes Drizzle's static types at
// compile time, so cast through `unknown` to reach the underlying Mock API.
const asMock = (value: unknown) => value as Mock<(...args: never[]) => unknown>;

afterEach(() => {
  mock.restore();
  // The shared mockDb is not created via spyOn, so mock.restore() does not reset
  // its call history. Clear the top-level builders we assert call counts on.
  asMock(db.insert).mockClear();
  asMock(db.update).mockClear();
  asMock(db.delete).mockClear();
  asMock(db.select).mockClear();
  asMock(db.transaction).mockClear();
});

describe("createClub", () => {
  it("inserts a club then an owner membership inside a transaction (happy path)", async () => {
    const inserts: unknown[] = [];

    asMock(db.transaction).mockImplementationOnce((async (fn: any) => {
      const tx = {
        insert: mock(() => {
          const builder: any = {
            values: mock((v: unknown) => {
              inserts.push(v);
              return builder;
            }),
            returning: mock(async () => [{ id: "club-1", name: "Test Club" }]),
          };
          return builder;
        }),
      };
      return fn(tx);
    }) as never);

    const club = await clubService.createClub("Test Club", "owner-1");

    expect(club).toMatchObject({ id: "club-1", name: "Test Club" });
    expect(inserts).toEqual([{ name: "Test Club" }, { clubId: "club-1", userId: "owner-1", role: "owner" }]);
    expect(asMock(db.transaction)).toHaveBeenCalledTimes(1);
  });

  it("throws when the club insert returns nothing", async () => {
    // The default tx stub's returning() resolves to [], so newClub is undefined.
    await expect(clubService.createClub("Test Club", "owner-1")).rejects.toThrow("Failed to create club");
  });
});

describe("transferOwnership", () => {
  it("demotes the old owner to admin and promotes the new owner inside a transaction", async () => {
    const updates: unknown[] = [];

    asMock(db.transaction).mockImplementationOnce((async (fn: any) => {
      const tx = {
        update: mock(() => {
          const builder: any = {
            set: mock((v: unknown) => {
              updates.push(v);
              return builder;
            }),
            where: mock(() => builder),
          };
          return builder;
        }),
      };
      return fn(tx);
    }) as never);

    await clubService.transferOwnership("club-1", "old-owner", "new-owner");

    expect(updates).toEqual([{ role: "admin" }, { role: "owner" }]);
    expect(asMock(db.transaction)).toHaveBeenCalledTimes(1);
  });
});

describe("acceptInvite", () => {
  it("throws when the invite is not found", async () => {
    (db.query.clubInvites.findFirst as Mock<typeof db.query.clubInvites.findFirst>).mockResolvedValueOnce(undefined);

    await expect(clubService.acceptInvite("club-1", "user-1")).rejects.toThrow("Invite not found");
    expect(asMock(db.transaction)).not.toHaveBeenCalled();
  });

  it("inserts the member and deletes the invite inside a transaction when the invite exists", async () => {
    (db.query.clubInvites.findFirst as Mock<typeof db.query.clubInvites.findFirst>).mockResolvedValueOnce({
      clubId: "club-1",
      inviteeId: "user-1",
    } as never);

    const txCalls: { kind: "insert" | "delete"; values?: unknown }[] = [];

    asMock(db.transaction).mockImplementationOnce((async (fn: any) => {
      const tx = {
        insert: mock(() => {
          const builder: any = {
            values: mock((v: unknown) => {
              txCalls.push({ kind: "insert", values: v });
              return builder;
            }),
            onConflictDoNothing: mock(() => builder),
          };
          return builder;
        }),
        delete: mock(() => {
          txCalls.push({ kind: "delete" });
          const builder: any = { where: mock(() => builder) };
          return builder;
        }),
      };
      return fn(tx);
    }) as never);

    await clubService.acceptInvite("club-1", "user-1");

    expect(asMock(db.transaction)).toHaveBeenCalledTimes(1);
    expect(txCalls).toEqual([
      { kind: "insert", values: { clubId: "club-1", userId: "user-1", role: "member" } },
      { kind: "delete" },
    ]);
  });
});

describe("leaveClub", () => {
  it("throws when the caller is not a member", async () => {
    (db.query.clubMembers.findFirst as Mock<typeof db.query.clubMembers.findFirst>).mockResolvedValueOnce(undefined);

    await expect(clubService.leaveClub("club-1", "user-1")).rejects.toThrow("You are not a member of this club");
  });

  it("throws when the caller is the owner", async () => {
    (db.query.clubMembers.findFirst as Mock<typeof db.query.clubMembers.findFirst>).mockResolvedValueOnce({
      role: "owner",
    } as never);

    await expect(clubService.leaveClub("club-1", "user-1")).rejects.toThrow(
      "You must transfer ownership before leaving the club",
    );
  });

  it("deletes the membership for a non-owner member", async () => {
    (db.query.clubMembers.findFirst as Mock<typeof db.query.clubMembers.findFirst>).mockResolvedValueOnce({
      role: "member",
    } as never);
    const deleteSpy = asMock(db.delete);

    await clubService.leaveClub("club-1", "user-1");

    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });
});

describe("single-statement mutations", () => {
  it("removeMember issues a single delete", async () => {
    const deleteSpy = asMock(db.delete);

    await clubService.removeMember("club-1", "user-1");

    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });

  it("changeRole issues a single update setting the new role", async () => {
    const updateSpy = asMock(db.update);

    await clubService.changeRole("club-1", "user-1", "admin");

    expect(updateSpy).toHaveBeenCalledTimes(1);
  });

  it("declineInvite issues a single delete", async () => {
    const deleteSpy = asMock(db.delete);

    await clubService.declineInvite("club-1", "user-1");

    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });

  it("deleteClub issues a single delete", async () => {
    const deleteSpy = asMock(db.delete);

    await clubService.deleteClub("club-1");

    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });
});

describe("role predicates", () => {
  it("isOwner is true only for the owner role", () => {
    expect(clubService.isOwner(undefined)).toBe(false);
    expect(clubService.isOwner({ role: "owner" })).toBe(true);
    expect(clubService.isOwner({ role: "admin" })).toBe(false);
    expect(clubService.isOwner({ role: "member" })).toBe(false);
  });

  it("isAdmin is true only for the admin role", () => {
    expect(clubService.isAdmin(undefined)).toBe(false);
    expect(clubService.isAdmin({ role: "owner" })).toBe(false);
    expect(clubService.isAdmin({ role: "admin" })).toBe(true);
    expect(clubService.isAdmin({ role: "member" })).toBe(false);
  });

  it("isOwnerOrAdmin is true for owner and admin only", () => {
    expect(clubService.isOwnerOrAdmin(undefined)).toBe(false);
    expect(clubService.isOwnerOrAdmin({ role: "owner" })).toBe(true);
    expect(clubService.isOwnerOrAdmin({ role: "admin" })).toBe(true);
    expect(clubService.isOwnerOrAdmin({ role: "member" })).toBe(false);
  });
});
