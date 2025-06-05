import { addDays, differenceInSeconds } from "date-fns";
import { and, eq, inArray } from "drizzle-orm";
import jwt from "jsonwebtoken";
import * as v from "valibot";
import { env } from "../config/env";
import { db } from "../lib/db";
import * as schema from "../lib/db/schema";
import { tryCatch } from "../utils/try-catch";
import { LobbyTokenSchema } from "./models";

export class LobbyService {
  async getLobbyById(id: string) {
    const lobby = await db.query.lobbies.findFirst({
      where: {
        id,
      },
      with: {
        users: true,
        selectedClub: {
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

    return lobby;
  }

  async createLobby() {
    const [lobby] = await db
      .insert(schema.lobbies)
      .values({
        id: this.generateLobbyCode(),
      })
      .returning();

    return lobby;
  }

  private generateLobbyCode(length = 8) {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    return Array.from({ length }, () => characters[Math.floor(Math.random() * characters.length)]).join("");
  }

  public async generateLobbyToken(lobbyId: string) {
    const expires = addDays(new Date(), 7);

    const token = jwt.sign(
      {
        type: "lobby",
      },
      env.JWT_SECRET,
      {
        expiresIn: differenceInSeconds(expires, new Date()),
        subject: lobbyId,
        issuer: env.API_URL,
        audience: env.API_URL,
      },
    );

    return token;
  }

  async verifyLobbyToken(accessToken: string) {
    const [error, decoded] = await tryCatch(() => jwt.verify(accessToken, env.JWT_SECRET));

    if (error) {
      return null;
    }

    const result = v.safeParse(LobbyTokenSchema, decoded);

    if (!result.success) {
      return null;
    }

    return result.output;
  }

  async joinLobby(lobbyId: string, userId: string) {
    await db
      .update(schema.users)
      .set({
        lobbyId,
      })
      .where(eq(schema.users.id, userId));
  }

  async leaveLobby(userId: string) {
    await db.update(schema.users).set({ lobbyId: null }).where(eq(schema.users.id, userId));
  }

  async kickUser(lobbyId: string, userId: string) {
    await db
      .update(schema.users)
      .set({ lobbyId: null })
      .where(and(eq(schema.users.lobbyId, lobbyId), eq(schema.users.id, userId)));
  }

  async deleteLobby(lobbyId: string) {
    await db.delete(schema.lobbies).where(eq(schema.lobbies.id, lobbyId));
  }

  async updateLobbySelectedClub(lobbyId: string, clubId: string | null) {
    const [updatedLobby] = await db
      .update(schema.lobbies)
      .set({ clubId: clubId })
      .where(eq(schema.lobbies.id, lobbyId))
      .returning();

    return updatedLobby;
  }

  async getAvailableClubsForLobby(lobbyId: string) {
    const lobby = await this.getLobbyById(lobbyId);
    if (!lobby) {
      return [];
    }

    // Get all unique clubs that lobby users are members of
    const userIds = lobby.users.map((user) => user.id);
    
    if (userIds.length === 0) {
      return [];
    }

    const clubMemberships = await db
      .select({
        clubId: schema.clubMembers.clubId,
        club: schema.clubs,
      })
      .from(schema.clubMembers)
      .innerJoin(schema.clubs, eq(schema.clubMembers.clubId, schema.clubs.id))
      .where(inArray(schema.clubMembers.userId, userIds));

    const clubsMap = new Map<string, typeof schema.clubs.$inferSelect>();
    for (const membership of clubMemberships) {
      if (!clubsMap.has(membership.club.id)) {
        clubsMap.set(membership.club.id, membership.club);
      }
    }

    return Array.from(clubsMap.values());
  }
}

export const lobbyService = new LobbyService();
