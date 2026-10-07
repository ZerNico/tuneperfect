import { beforeEach, describe, expect, it, type Mock } from "bun:test";
import crypto from "node:crypto";

import { addDays, subDays, subSeconds, subYears } from "date-fns";
import jwt from "jsonwebtoken";

import { env } from "../config/env";
import { db } from "../lib/db";
import type { User } from "../types";
import { authService } from "./service";

// Return type must be a Promise so mockResolvedValue accepts any value
// (with a plain `unknown` return type it would infer `never`).
type AnyMock = Mock<(...args: unknown[]) => Promise<unknown>>;

const findFirstUser = db.query.users.findFirst as unknown as AnyMock;
const findFirstRefreshToken = db.query.refreshTokens.findFirst as unknown as AnyMock;

const testUser: User = {
  id: "00000000-0000-4000-8000-000000000001",
  email: "user@test.localhost",
  emailVerified: true,
  username: "tester",
  image: null,
  lobbyId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
} as User;

const sha256 = (value: string) => crypto.createHash("sha256").update(value).digest("hex");

/** Makes the next db.<method>(...)...returning() resolve to `rows` (the shared stub always returns []). */
function nextReturning(method: "update" | "delete", rows: unknown[]) {
  const spy = db[method] as unknown as AnyMock;
  spy.mockImplementationOnce((() => {
    const builder = {
      set: () => builder,
      where: () => builder,
      returning: async () => rows,
    };
    return builder;
  }) as never);
}

beforeEach(() => {
  findFirstUser.mockReset();
  findFirstRefreshToken.mockReset();
});

describe("password hashing", () => {
  it("hashes with argon2id and verifies the roundtrip", async () => {
    const hash = await authService.hashPassword("correct horse battery staple");

    expect(hash).toStartWith("$argon2id$");
    expect(await Bun.password.verify("correct horse battery staple", hash)).toBe(true);
    expect(await Bun.password.verify("wrong password", hash)).toBe(false);
  });
});

describe("comparePasswords", () => {
  it("returns the user without the password field on success", async () => {
    const hash = await authService.hashPassword("hunter22hunter22");
    findFirstUser.mockResolvedValue({ ...testUser, password: hash });

    const result = await authService.comparePasswords("hunter22hunter22", testUser.email);

    expect(result).not.toBeNull();
    expect(result?.id).toBe(testUser.id);
    expect(result).not.toHaveProperty("password", expect.anything());
    expect((result as Record<string, unknown>).password).toBeUndefined();
  });

  it("returns null for a wrong password", async () => {
    const hash = await authService.hashPassword("hunter22hunter22");
    findFirstUser.mockResolvedValue({ ...testUser, password: hash });

    expect(await authService.comparePasswords("not-the-password", testUser.email)).toBeNull();
  });

  it("returns null for an unknown email", async () => {
    findFirstUser.mockResolvedValue(undefined);

    expect(await authService.comparePasswords("whatever", "nobody@test.localhost")).toBeNull();
  });

  it("returns null for OAuth-only users without a password", async () => {
    findFirstUser.mockResolvedValue({ ...testUser, password: null });

    expect(await authService.comparePasswords("whatever", testUser.email)).toBeNull();
  });
});

describe("access tokens", () => {
  it("roundtrips a generated token", async () => {
    const { token, expires } = await authService.generateAccessToken(testUser);

    expect(expires.getTime()).toBeGreaterThan(Date.now());

    const payload = await authService.verifyAccessToken(token);

    expect(payload).not.toBeNull();
    expect(payload?.sub).toBe(testUser.id);
    expect(payload?.type).toBe("access");
  });

  it("rejects a tampered token", async () => {
    const { token } = await authService.generateAccessToken(testUser);
    const [header, payload, signature] = token.split(".");
    const tamperedPayload = Buffer.from(
      JSON.stringify({ ...JSON.parse(Buffer.from(payload as string, "base64url").toString()), sub: "someone-else" }),
    ).toString("base64url");

    expect(await authService.verifyAccessToken(`${header}.${tamperedPayload}.${signature}`)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const forged = jwt.sign({ type: "access" }, "wrong-secret", {
      expiresIn: 300,
      subject: testUser.id,
      issuer: env.API_URL,
      audience: env.API_URL,
    });

    expect(await authService.verifyAccessToken(forged)).toBeNull();
  });

  it("rejects a token with wrong issuer or audience", async () => {
    const wrongIssuer = jwt.sign({ type: "access" }, env.JWT_SECRET, {
      expiresIn: 300,
      subject: testUser.id,
      issuer: "https://evil.com",
      audience: env.API_URL,
    });
    const wrongAudience = jwt.sign({ type: "access" }, env.JWT_SECRET, {
      expiresIn: 300,
      subject: testUser.id,
      issuer: env.API_URL,
      audience: "https://evil.com",
    });

    expect(await authService.verifyAccessToken(wrongIssuer)).toBeNull();
    expect(await authService.verifyAccessToken(wrongAudience)).toBeNull();
  });

  it("rejects an unsigned (alg: none) token", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(
      JSON.stringify({
        type: "access",
        sub: testUser.id,
        iss: env.API_URL,
        aud: env.API_URL,
        exp: Math.floor(Date.now() / 1000) + 300,
      }),
    ).toString("base64url");

    expect(await authService.verifyAccessToken(`${header}.${payload}.`)).toBeNull();
  });

  it("rejects an expired token", async () => {
    const expired = jwt.sign({ type: "access" }, env.JWT_SECRET, {
      expiresIn: -10,
      subject: testUser.id,
      issuer: env.API_URL,
      audience: env.API_URL,
    });

    expect(await authService.verifyAccessToken(expired)).toBeNull();
  });

  it("rejects a lobby token (type confusion)", async () => {
    const lobbyToken = jwt.sign({ type: "lobby" }, env.JWT_SECRET, {
      expiresIn: 300,
      subject: "SOMELOBBY",
      issuer: env.API_URL,
      audience: env.API_URL,
    });

    expect(await authService.verifyAccessToken(lobbyToken)).toBeNull();
  });
});

describe("refresh tokens", () => {
  it("stores only a hash of the generated token", async () => {
    const insertSpy = db.insert as unknown as AnyMock;
    insertSpy.mockClear();

    const { token, expires } = await authService.generateAndStoreRefreshToken(testUser, "test-agent");

    expect(token).toHaveLength(64); // 32 random bytes, hex encoded
    expect(expires.getTime()).toBeGreaterThan(Date.now());

    const builder = insertSpy.mock.results[0]?.value as { values: AnyMock };
    const inserted = builder.values.mock.calls[0]?.[0] as { token: string };

    expect(inserted.token).not.toBe(token);
    expect(inserted.token).toHaveLength(64); // sha256 hex digest
  });

  it("rotates a valid refresh token to 30 days from now", async () => {
    findFirstRefreshToken.mockResolvedValue({
      token: sha256("some-presented-token"),
      userId: testUser.id,
      user: testUser,
      expires: addDays(new Date(), 300),
      createdAt: new Date(),
    });
    nextReturning("update", [{ token: "new-hash" }]);

    const result = await authService.verifyAndRotateRefreshToken("some-presented-token");

    expect(result).not.toBeNull();
    expect(result?.token).toHaveLength(64);
    expect(result?.token).not.toBe("some-presented-token");
    expect(result?.user.id).toBe(testUser.id);
    // From now, not stacked onto the old expiry
    expect(Math.round((result!.expires.getTime() - Date.now()) / 86_400_000)).toBe(30);
  });

  it("keeps the cookie of a concurrent refresh that rotated first", async () => {
    findFirstRefreshToken
      .mockResolvedValueOnce({
        token: sha256("raced"),
        userId: testUser.id,
        user: testUser,
        expires: addDays(new Date(), 3),
        createdAt: new Date(),
      })
      .mockResolvedValueOnce({ expires: addDays(new Date(), 30) });
    nextReturning("update", []);

    const result = await authService.verifyAndRotateRefreshToken("raced");

    expect(result?.user.id).toBe(testUser.id);
    expect(result?.token).toBeUndefined();
  });

  it("lets nobody in when the login was ended between reading and rotating it", async () => {
    findFirstRefreshToken
      .mockResolvedValueOnce({
        token: sha256("revoked"),
        userId: testUser.id,
        user: testUser,
        expires: addDays(new Date(), 3),
        createdAt: new Date(),
      })
      .mockResolvedValueOnce(undefined);
    nextReturning("update", []);

    expect(await authService.verifyAndRotateRefreshToken("revoked")).toBeNull();
  });

  it("accepts the replaced token for a few seconds without rotating again", async () => {
    const updateSpy = db.update as unknown as AnyMock;
    updateSpy.mockClear();
    findFirstRefreshToken.mockResolvedValue({
      token: "current-hash",
      previousToken: sha256("just-replaced"),
      rotatedAt: subSeconds(new Date(), 5),
      userId: testUser.id,
      user: testUser,
      expires: addDays(new Date(), 30),
      createdAt: new Date(),
    });

    const result = await authService.verifyAndRotateRefreshToken("just-replaced");

    expect(result?.user.id).toBe(testUser.id);
    expect(result?.token).toBeUndefined();
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it("ends the login when a replaced token comes back later", async () => {
    const deleteSpy = db.delete as unknown as AnyMock;
    deleteSpy.mockClear();
    findFirstRefreshToken.mockResolvedValue({
      token: "current-hash",
      previousToken: sha256("stolen"),
      rotatedAt: subSeconds(new Date(), 120),
      userId: testUser.id,
      user: testUser,
      expires: addDays(new Date(), 30),
      createdAt: new Date(),
    });

    expect(await authService.verifyAndRotateRefreshToken("stolen")).toBeNull();
    expect(deleteSpy).toHaveBeenCalled();
  });

  it("returns null for an unknown token", async () => {
    findFirstRefreshToken.mockResolvedValue(undefined);

    expect(await authService.verifyAndRotateRefreshToken("unknown")).toBeNull();
  });

  it("returns null and deletes an expired token", async () => {
    const deleteSpy = db.delete as unknown as AnyMock;
    deleteSpy.mockClear();
    findFirstRefreshToken.mockResolvedValue({
      token: "stored-hash",
      userId: testUser.id,
      user: testUser,
      expires: subDays(new Date(), 1),
      createdAt: subDays(new Date(), 8),
    });

    expect(await authService.verifyAndRotateRefreshToken("expired")).toBeNull();
    expect(deleteSpy).toHaveBeenCalled();
  });

  it("enforces the one year absolute lifetime cap", async () => {
    findFirstRefreshToken.mockResolvedValue({
      token: "stored-hash",
      userId: testUser.id,
      user: testUser,
      expires: addDays(new Date(), 3), // still "valid" via sliding window
      createdAt: subYears(new Date(), 1.1),
    });

    expect(await authService.verifyAndRotateRefreshToken("ancient")).toBeNull();
  });
});

describe("verification tokens", () => {
  it("generates 32 random bytes hex encoded", async () => {
    const token = await authService.createAndStoreVerificationToken(testUser.id, "email_verification");

    expect(token).toHaveLength(64);
    expect(token).toMatch(/^[0-9a-f]+$/);
  });

  it("returns null for an expired token, deleting it in the same step", async () => {
    nextReturning("delete", [
      { token: "stored", userId: testUser.id, type: "password_reset", expires: subDays(new Date(), 1) },
    ]);

    expect(await authService.verifyAndDeleteVerificationToken("stored", "password_reset")).toBeNull();
  });

  it("is single use: a second use finds nothing", async () => {
    const row = {
      token: "stored",
      userId: testUser.id,
      type: "password_reset" as const,
      expires: addDays(new Date(), 1),
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    nextReturning("delete", [row]);

    expect(await authService.verifyAndDeleteVerificationToken("stored", "password_reset")).toEqual(row);
    expect(await authService.verifyAndDeleteVerificationToken("stored", "password_reset")).toBeNull();
  });
});

describe("deleteAllRefreshTokensForUser", () => {
  it("deletes all tokens for the user", async () => {
    const deleteSpy = db.delete as unknown as AnyMock;
    deleteSpy.mockClear();

    await authService.deleteAllRefreshTokensForUser(testUser.id);

    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });

  it("supports keeping the current session token", async () => {
    const deleteSpy = db.delete as unknown as AnyMock;
    deleteSpy.mockClear();

    await authService.deleteAllRefreshTokensForUser(testUser.id, "current-token");

    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });
});
