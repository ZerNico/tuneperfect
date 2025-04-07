import { and, eq } from "drizzle-orm";
import { SignJWT, jwtVerify } from "jose";
import * as v from "valibot";
import { db } from "../../config/db";
import * as schema from "../../config/db/schema";
import { users } from "../../config/db/schema";
import { env } from "../../config/env";
import { LobbyTokenSchema } from "./lobby.models";

class LobbyService {
  private jwtSecret = new TextEncoder().encode(env.JWT_SECRET);

  async createLobby() {
    const [lobby] = await db
      .insert(schema.lobbies)
      .values({ id: this.generateLobbyCode(6) })
      .returning();

    return lobby;
  }

  private generateLobbyCode(length: number) {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";

    for (let i = 0; i < length; i++) {
      code += characters[Math.floor(Math.random() * characters.length)];
    }

    return code;
  }

  async getById(id: string) {
    return db.query.lobbies.findFirst({
      where: {
        id: id,
      },
    });
  }

  async getByIdWithUsers(id: string) {
    return db.query.lobbies.findFirst({
      where: {
        id: id,
      },
      with: {
        users: true,
      },
    });
  }

  async join(lobbyId: string, userId: string) {
    await db.update(users).set({ lobbyId }).where(eq(users.id, userId));
  }

  async leave(userId: string) {
    await db.update(users).set({ lobbyId: null }).where(eq(users.id, userId));
  }

  async createLobbyToken(lobbyId: string) {
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);

    return {
      token: await new SignJWT({ type: "lobby" })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setIssuer("api")
        .setAudience("api")
        .setSubject(lobbyId)
        .setExpirationTime(expiresAt)
        .sign(this.jwtSecret),
      expiresAt,
    };
  }

  async verifyLobbyToken(token: string) {
    try {
      const { payload } = await jwtVerify(token, this.jwtSecret, { issuer: "api", audience: "api" });
      return v.parse(LobbyTokenSchema, payload);
    } catch (error) {
      return;
    }
  }

  async kick(lobbyId: string, userId: string) {
    await db
      .update(users)
      .set({ lobbyId: null })
      .where(and(eq(users.id, userId), eq(users.lobbyId, lobbyId)));
  }
}

export const lobbyService = new LobbyService();
