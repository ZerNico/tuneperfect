import { addDays, differenceInSeconds } from "date-fns";
import { and, eq } from "drizzle-orm";
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
}

export const lobbyService = new LobbyService();
