import crypto from "node:crypto";

import { renderResetPassword, renderVerifyEmail } from "@tuneperfect/email";
import { addDays, addHours, addMinutes, addSeconds, addYears, differenceInSeconds, isAfter, isBefore } from "date-fns";
import { and, eq, ne, sql } from "drizzle-orm";
import jwt from "jsonwebtoken";
import { joinURL, withQuery } from "ufo";
import * as v from "valibot";

import { env } from "../config/env";
import { db } from "../lib/db";
import * as schema from "../lib/db/schema";
import { sendEmail } from "../lib/email";
import { logger } from "../lib/logger";
import type { User } from "../types";
import { isValidRedirectUrl } from "../utils/security";
import { tryCatch } from "../utils/try-catch";
import { AccessTokenSchema } from "./models";

/** A login ends after this many days without use. Every refresh pushes it out again, up to a year in total. */
const REFRESH_IDLE_DAYS = 30;
/** How long the token a refresh replaced keeps working, for requests that were already in flight. */
const REFRESH_GRACE_SECONDS = 30;

class AuthService {
  async createAndStoreVerificationToken(userId: string, type: "email_verification" | "password_reset") {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = addHours(new Date(), 1);

    await db.insert(schema.verificationTokens).values({
      userId,
      token,
      type,
      expires,
    });

    return token;
  }

  async verifyAndDeleteVerificationToken(token: string, type: "email_verification" | "password_reset") {
    // Deleting and reading in one statement: two concurrent uses can't both get the token
    const [verificationToken] = await db
      .delete(schema.verificationTokens)
      .where(and(eq(schema.verificationTokens.token, token), eq(schema.verificationTokens.type, type)))
      .returning();

    if (!verificationToken || isBefore(verificationToken.expires, new Date())) {
      return null;
    }

    return verificationToken;
  }

  async deleteVerificationTokens(userId: string, type: "email_verification" | "password_reset") {
    await db
      .delete(schema.verificationTokens)
      .where(and(eq(schema.verificationTokens.userId, userId), eq(schema.verificationTokens.type, type)));
  }

  async sendVerificationEmail(user: User, options: { redirect?: string } = {}) {
    const redirect =
      options.redirect && isValidRedirectUrl(options.redirect, [env.APP_URL]) ? options.redirect : undefined;

    const token = await this.createAndStoreVerificationToken(user.id, "email_verification");

    const url = withQuery(joinURL(env.API_URL, "/v1.0/auth/verify-email"), { token, redirect });
    const { html, text } = await renderVerifyEmail({ verifyUrl: url, supportEmail: env.SUPPORT_EMAIL });

    try {
      await sendEmail(user.email, "Verify your E-Mail", html, text);
    } catch (error) {
      logger.error(error, "Failed to send verification email");
    }
  }

  async sendPasswordResetEmail(user: User) {
    const token = await this.createAndStoreVerificationToken(user.id, "password_reset");

    const resetUrl = withQuery(joinURL(env.APP_URL, "/reset-password"), { token });
    const { html, text } = await renderResetPassword({
      resetUrl,
      supportEmail: env.SUPPORT_EMAIL,
    });

    try {
      await sendEmail(user.email, "Reset your Password", html, text);
    } catch (error) {
      logger.error(error, "Failed to send password reset email");
    }

    return token;
  }

  async comparePasswords(password: string, email: string) {
    const user = await db.query.users.findFirst({
      where: {
        RAW: (table) => sql`lower(${table.email}) = ${email.toLowerCase()}`,
      },
    });

    if (!user || !user.password) {
      return null;
    }

    const isPasswordValid = await Bun.password.verify(password, user.password);

    if (!isPasswordValid) {
      return null;
    }

    const { password: _, ...userWithoutPassword } = user;

    return userWithoutPassword;
  }

  async hashPassword(password: string) {
    return await Bun.password.hash(password);
  }

  async generateAccessToken(user: User) {
    const expires = addMinutes(new Date(), 5);

    const token = jwt.sign(
      {
        type: "access",
      },
      env.JWT_SECRET,
      {
        expiresIn: differenceInSeconds(expires, new Date()),
        subject: user.id,
        issuer: env.API_URL,
        audience: env.API_URL,
      },
    );

    return { token, expires };
  }

  private hashToken(token: string) {
    return crypto.createHash("sha256").update(token).digest("hex");
  }

  async generateAndStoreRefreshToken(user: User, userAgent: string) {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = addDays(new Date(), REFRESH_IDLE_DAYS);

    await db.insert(schema.refreshTokens).values({
      userId: user.id,
      token: this.hashToken(token),
      userAgent,
      expires,
    });

    return { token, expires };
  }

  /**
   * Swaps a refresh token for a new one. Returns `token: undefined` when the presented token was rotated
   * moments ago by a concurrent refresh (another tab): the caller keeps the cookie that refresh set.
   * Presenting a rotated token after the grace period means it leaked, so that login is ended.
   */
  async verifyAndRotateRefreshToken(refreshToken: string) {
    const hashedToken = this.hashToken(refreshToken);
    const now = new Date();

    const token = await db.query.refreshTokens.findFirst({
      where: {
        OR: [{ token: hashedToken }, { previousToken: hashedToken }],
      },
      with: {
        user: true,
      },
    });

    if (!token || !token.user) {
      return null;
    }

    if (isBefore(token.expires, now) || isAfter(now, addYears(token.createdAt, 1))) {
      await db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.token, token.token));

      return null;
    }

    if (token.token !== hashedToken) {
      if (token.rotatedAt && isAfter(addSeconds(token.rotatedAt, REFRESH_GRACE_SECONDS), now)) {
        return { token: undefined, expires: token.expires, user: token.user };
      }

      logger.warn({ userId: token.userId }, "Rotated refresh token reused, ending that login");
      await db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.token, token.token));

      return null;
    }

    const newExpires = addDays(now, REFRESH_IDLE_DAYS);
    const newToken = crypto.randomBytes(32).toString("hex");

    const [rotated] = await db
      .update(schema.refreshTokens)
      .set({ expires: newExpires, token: this.hashToken(newToken), previousToken: hashedToken, rotatedAt: now })
      .where(eq(schema.refreshTokens.token, hashedToken))
      .returning({ token: schema.refreshTokens.token });

    // A concurrent refresh rotated it between our read and write: that one's cookie wins
    if (!rotated) {
      return { token: undefined, expires: token.expires, user: token.user };
    }

    return { token: newToken, expires: newExpires, user: token.user };
  }

  async deleteRefreshToken(refreshToken: string) {
    await db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.token, this.hashToken(refreshToken)));
  }

  /** The login a refresh token cookie belongs to; also right after a rotation, while the cookie may be the old one. */
  private async findSession(userId: string, refreshToken: string) {
    const hashedToken = this.hashToken(refreshToken);
    return await db.query.refreshTokens.findFirst({
      where: { userId, OR: [{ token: hashedToken }, { previousToken: hashedToken }] },
      columns: { id: true },
    });
  }

  /** Ends all of a user's logins, or all but the one `exceptToken` belongs to. */
  async deleteAllRefreshTokensForUser(userId: string, exceptToken?: string) {
    const current = exceptToken ? await this.findSession(userId, exceptToken) : undefined;

    await db
      .delete(schema.refreshTokens)
      .where(
        and(eq(schema.refreshTokens.userId, userId), current ? ne(schema.refreshTokens.id, current.id) : undefined),
      );
  }

  /** A user's logins, the one `currentToken` belongs to first, then the most recently used. */
  async listSessions(userId: string, currentToken?: string) {
    const current = currentToken ? await this.findSession(userId, currentToken) : undefined;
    const now = new Date();

    const sessions = await db.query.refreshTokens.findMany({
      where: { userId },
      columns: { id: true, userAgent: true, createdAt: true, updatedAt: true, expires: true },
    });

    return sessions
      .filter((session) => isAfter(session.expires, now))
      .map((session) => ({
        id: session.id,
        userAgent: session.userAgent,
        createdAt: session.createdAt,
        // Every refresh (about every 5 minutes in use) touches the row
        lastActiveAt: session.updatedAt,
        current: session.id === current?.id,
      }))
      .toSorted((a, b) => Number(b.current) - Number(a.current) || b.lastActiveAt.getTime() - a.lastActiveAt.getTime());
  }

  /** Ends one of the user's logins. Returns whether there was one with that id. */
  async deleteSession(userId: string, sessionId: string) {
    const deleted = await db
      .delete(schema.refreshTokens)
      .where(and(eq(schema.refreshTokens.userId, userId), eq(schema.refreshTokens.id, sessionId)))
      .returning({ id: schema.refreshTokens.id });

    return deleted.length > 0;
  }

  async verifyAccessToken(accessToken: string) {
    const [error, decoded] = await tryCatch(() =>
      jwt.verify(accessToken, env.JWT_SECRET, { issuer: env.API_URL, audience: env.API_URL, algorithms: ["HS256"] }),
    );

    if (error) {
      return null;
    }

    const result = v.safeParse(AccessTokenSchema, decoded);

    if (!result.success) {
      return null;
    }

    return result.output;
  }
}

export const authService = new AuthService();
