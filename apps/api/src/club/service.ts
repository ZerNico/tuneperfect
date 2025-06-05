import { and, eq } from "drizzle-orm";
import { db } from "../lib/db";
import * as schema from "../lib/db/schema";
import { userService } from "../user/service";
import { filterNullish } from "../utils/array";

export class ClubService {
  public async createClub(name: string, ownerId: string) {
    const club = await db.transaction(async (tx) => {
      const [newClub] = await tx
        .insert(schema.clubs)
        .values({
          name,
        })
        .returning();

      if (!newClub) {
        throw new Error("Failed to create club");
      }

      await tx.insert(schema.clubMembers).values({
        clubId: newClub.id,
        userId: ownerId,
        role: "owner",
      });

      return newClub;
    });

    return club;
  }

  public async getClub(clubId: string) {
    return await db.query.clubs.findFirst({
      where: {
        id: clubId,
      },
      with: {
        members: {
          with: {
            user: {
              columns: {
                password: false,
              },
            },
          },
        },
      },
    });
  }

  public async updateClub(clubId: string, data: { name: string }) {
    const [updatedClub] = await db.update(schema.clubs).set(data).where(eq(schema.clubs.id, clubId)).returning();

    return updatedClub;
  }

  public async getUserClubs(userId: string) {
    const memberships = await db.query.clubMembers.findMany({
      where: {
        userId: userId,
      },
      with: {
        club: {
          with: {
            members: {
              with: {
                user: {
                  columns: {
                    password: false,
                  },
                },
              },
            },
          },
        },
      },
    });

    return filterNullish(memberships.map((m) => m.club));
  }

  public async inviteUserToClub(clubId: string, inviterId: string, username: string) {
    const userToInvite = await userService.getUserByUsername(username);
    if (!userToInvite) {
      throw new Error("User not found");
    }

    const isMember = await this.isUserMemberOfClub(clubId, userToInvite.id);
    if (isMember) {
      throw new Error("User is already a member of this club");
    }

    const hasExistingInvite = await this.hasExistingInvite(clubId, userToInvite.id);
    if (hasExistingInvite) {
      throw new Error("User has a pending invite for this club");
    }

    await db.insert(schema.clubInvites).values({
      clubId,
      inviterId,
      inviteeId: userToInvite.id,
    });
  }

  private async isUserMemberOfClub(clubId: string, userId: string) {
    const member = await db.query.clubMembers.findFirst({
      where: {
        clubId,
        userId,
      },
    });

    return !!member;
  }

  private async hasExistingInvite(clubId: string, userId: string) {
    const invite = await db.query.clubInvites.findFirst({
      where: {
        clubId: clubId,
        inviteeId: userId,
      },
    });
    return !!invite;
  }

  public async getUserInvites(userId: string) {
    return await db.query.clubInvites.findMany({
      where: {
        inviteeId: userId,
      },
      with: {
        club: true,
        inviter: {
          columns: {
            password: false,
          },
        },
      },
    });
  }

  public async acceptInvite(clubId: string, userId: string) {
    const invite = await db.query.clubInvites.findFirst({
      where: {
        clubId,
        inviteeId: userId,
      },
    });

    if (!invite) {
      throw new Error("Invite not found");
    }

    await db.transaction(async (tx) => {
      await tx.insert(schema.clubMembers).values({
        clubId,
        userId,
        role: "member",
      });
      await tx
        .delete(schema.clubInvites)
        .where(and(eq(schema.clubInvites.clubId, clubId), eq(schema.clubInvites.inviteeId, userId)));
    });
  }

  public async declineInvite(clubId: string, userId: string) {
    await db
      .delete(schema.clubInvites)
      .where(and(eq(schema.clubInvites.clubId, clubId), eq(schema.clubInvites.inviteeId, userId)));
  }

  public async transferOwnership(clubId: string, currentOwnerId: string, newOwnerId: string) {
    await db.transaction(async (tx) => {
      await tx
        .update(schema.clubMembers)
        .set({ role: "admin" })
        .where(and(eq(schema.clubMembers.clubId, clubId), eq(schema.clubMembers.userId, currentOwnerId)));

      await tx
        .update(schema.clubMembers)
        .set({ role: "owner" })
        .where(and(eq(schema.clubMembers.clubId, clubId), eq(schema.clubMembers.userId, newOwnerId)));
    });
  }

  public async leaveClub(clubId: string, userId: string) {
    const member = await db.query.clubMembers.findFirst({
      where: {
        clubId,
        userId,
      },
    });

    if (!member) {
      throw new Error("You are not a member of this club");
    }

    if (member.role === "owner") {
      throw new Error("You must transfer ownership before leaving the club");
    }

    await db
      .delete(schema.clubMembers)
      .where(and(eq(schema.clubMembers.clubId, clubId), eq(schema.clubMembers.userId, userId)));
  }

  public async removeMember(clubId: string, userId: string) {
    await db
      .delete(schema.clubMembers)
      .where(and(eq(schema.clubMembers.clubId, clubId), eq(schema.clubMembers.userId, userId)));
  }

  public async deleteClub(clubId: string) {
    await db.delete(schema.clubs).where(eq(schema.clubs.id, clubId));
  }

  public async changeRole(clubId: string, userId: string, role: "admin" | "member") {
    await db
      .update(schema.clubMembers)
      .set({ role })
      .where(and(eq(schema.clubMembers.clubId, clubId), eq(schema.clubMembers.userId, userId)));
  }

  public isOwner(member: { role: string } | undefined) {
    return member?.role === "owner";
  }

  public isAdmin(member: { role: string } | undefined) {
    return member?.role === "admin";
  }

  public isOwnerOrAdmin(member: { role: string } | undefined) {
    return this.isOwner(member) || this.isAdmin(member);
  }
}

export const clubService = new ClubService();
