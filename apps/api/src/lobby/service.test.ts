import { type Mock, describe, expect, it } from "bun:test";

import jwt from "jsonwebtoken";

import { authService } from "../auth/service";
import { env } from "../config/env";
import { db } from "../lib/db";
import type { User } from "../types";
import { LobbyService, lobbyService } from "./service";

describe("getLobbyById", () => {
  it("never selects the password column for lobby users", async () => {
    await lobbyService.getLobbyById("LOBBY123");

    const findFirst = db.query.lobbies.findFirst as Mock<typeof db.query.lobbies.findFirst>;
    const args = findFirst.mock.calls.at(-1)?.[0] as Record<string, any>;

    expect(args.with.users).toEqual({ columns: { password: false } });
    expect(args.with.selectedClub.with.members.with.user.columns.password).toBe(false);
  });
});

describe("lobby codes", () => {
  it("generates 8 character codes from the unambiguous charset", () => {
    // generateLobbyCode is private; exercise it via a subclass accessor.
    const service = new (class extends LobbyService {
      public generate() {
        // @ts-expect-error accessing private member for testing
        return this.generateLobbyCode();
      }
    })();

    for (let i = 0; i < 100; i++) {
      const code = service.generate();
      expect(code).toHaveLength(8);
      // No I, O, 0, 1 — they are visually ambiguous
      expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
    }
  });
});

describe("lobby tokens", () => {
  it("roundtrips a generated lobby token", async () => {
    const token = await lobbyService.generateLobbyToken("LOBBY123");
    const payload = await lobbyService.verifyLobbyToken(token);

    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe("LOBBY123");
    expect(payload?.type).toBe("lobby");
  });

  it("rejects an access token (type confusion)", async () => {
    const { token: accessToken } = await authService.generateAccessToken({
      id: "00000000-0000-4000-8000-000000000001",
    } as User);

    expect(await lobbyService.verifyLobbyToken(accessToken)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const forged = jwt.sign({ type: "lobby" }, "wrong-secret", {
      expiresIn: 300,
      subject: "LOBBY123",
      issuer: env.API_URL,
      audience: env.API_URL,
    });

    expect(await lobbyService.verifyLobbyToken(forged)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const expired = jwt.sign({ type: "lobby" }, env.JWT_SECRET, {
      expiresIn: -10,
      subject: "LOBBY123",
      issuer: env.API_URL,
      audience: env.API_URL,
    });

    expect(await lobbyService.verifyLobbyToken(expired)).toBeNull();
  });
});
