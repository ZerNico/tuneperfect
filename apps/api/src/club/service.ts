import { and, eq } from "drizzle-orm";
import { db } from "../lib/db";
import * as schema from "../lib/db/schema";
import { userService } from "../user/service";

class ClubService {
  async createClub(name: string, ownerId: string) {
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

  async getClub(clubId: string) {
    const club = await db.query.clubs.findFirst({
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

    const members =
      club?.members.filter(
        (
          member,
        ): member is NonNullable<typeof member> & {
          user: NonNullable<typeof member.user>;
        } => member.user !== null,
      ) ?? [];

    return {
      ...club,
      members,
    };
  }

  async updateClub(clubId: string, data: Partial<typeof schema.clubs.$inferSelect>) {
    const [updatedClub] = await db.update(schema.clubs).set(data).where(eq(schema.clubs.id, clubId)).returning();

    if (!updatedClub) {
      throw new Error("Failed to update club");
    }

    return updatedClub;
  }

  async getUserClubs(userId: string) {
    const memberships = await db.query.clubMembers.findMany({
      where: {
        userId,
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

    return memberships
      .map((membership) => membership.club)
      .filter((club): club is NonNullable<typeof club> => club !== null)
      .map((club) => ({
        ...club,
        members: club.members.filter(
          (
            member,
          ): member is NonNullable<typeof member> & {
            user: NonNullable<typeof member.user>;
          } => member.user !== null,
        ),
      }));
  }

  async inviteUserToClub(clubId: string, inviterId: string, username: string) {
    const existingMember = await db.query.clubMembers.findFirst({
      where: {
        clubId,
        user: {
          username,
        },
      },
    });

    if (existingMember) {
      return;
    }

    const existingInvite = await db.query.clubInvites.findFirst({
      where: {
        clubId,
        invitee: {
          username,
        },
      },
    });

    if (existingInvite) {
      return;
    }

    const invitee = await userService.getUserByUsername(username);

    if (!invitee) {
      throw new Error("User not found");
    }

    await db.insert(schema.clubInvites).values({
      clubId,
      inviterId,
      inviteeId: invitee.id,
    });
  }

  async getUserInvites(userId: string) {
    return db.query.clubInvites.findMany({
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

  async acceptInvite(clubId: string, userId: string) {
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

  async declineInvite(clubId: string, userId: string) {
    await db
      .delete(schema.clubInvites)
      .where(and(eq(schema.clubInvites.clubId, clubId), eq(schema.clubInvites.inviteeId, userId)));
  }

  async transferOwnership(clubId: string, newOwnerId: string) {
    await db.transaction(async (tx) => {
      const currentOwner = await tx.query.clubMembers.findFirst({
        where: {
          clubId,
          role: "owner",
        },
      });

      if (!currentOwner) {
        throw new Error("Current owner not found");
      }

      const newOwnerMember = await tx.query.clubMembers.findFirst({
        where: {
          clubId,
          userId: newOwnerId,
        },
      });

      if (!newOwnerMember) {
        throw new Error("New owner is not a member of this club");
      }

      await tx
        .update(schema.clubMembers)
        .set({ role: "admin" })
        .where(and(eq(schema.clubMembers.clubId, clubId), eq(schema.clubMembers.userId, currentOwner.userId)));

      await tx
        .update(schema.clubMembers)
        .set({ role: "owner" })
        .where(and(eq(schema.clubMembers.clubId, clubId), eq(schema.clubMembers.userId, newOwnerId)));
    });
  }

  async leaveClub(clubId: string, userId: string) {
    const member = await db.query.clubMembers.findFirst({
      where: {
        clubId,
        userId,
      },
    });

    if (!member) {
      return;
    }

    if (member.role === "owner") {
      throw new Error("Transfer ownership first.");
    }

    await db
      .delete(schema.clubMembers)
      .where(and(eq(schema.clubMembers.clubId, clubId), eq(schema.clubMembers.userId, userId)));
  }

  async removeMember(clubId: string, userId: string) {
    const member = await db.query.clubMembers.findFirst({
      where: {
        clubId,
        userId,
      },
    });

    if (!member) {
      return;
    }

    await db
      .delete(schema.clubMembers)
      .where(and(eq(schema.clubMembers.clubId, clubId), eq(schema.clubMembers.userId, userId)));
  }

  async deleteClub(clubId: string) {
    return db.transaction(async (tx) => {
      await tx.delete(schema.clubInvites).where(eq(schema.clubInvites.clubId, clubId));

      await tx.delete(schema.clubMembers).where(eq(schema.clubMembers.clubId, clubId));
      await tx.delete(schema.clubs).where(eq(schema.clubs.id, clubId));
    });
  }

  async changeRole(clubId: string, userId: string, role: "admin" | "member") {
    const member = await db.query.clubMembers.findFirst({
      where: {
        clubId,
        userId,
      },
    });

    if (!member) {
      throw new Error("Member not found");
    }

    // Don't allow changing owner's role
    if (member.role === "owner") {
      throw new Error("Cannot change owner's role");
    }

    await db
      .update(schema.clubMembers)
      .set({ role })
      .where(and(eq(schema.clubMembers.clubId, clubId), eq(schema.clubMembers.userId, userId)));
  }
}

export const clubService = new ClubService();
