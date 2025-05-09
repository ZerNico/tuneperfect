import crypto from "node:crypto";
import { renderResetPassword, renderVerifyEmail } from "@tuneperfect/email";
import { addDays, addHours, addMinutes, addYears, differenceInSeconds, isAfter, isBefore } from "date-fns";
import { eq, sql } from "drizzle-orm";
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
    const verificationToken = await db.query.verificationTokens.findFirst({
      where: {
        token,
        type,
      },
    });

    if (!verificationToken) {
      return null;
    }

    if (isBefore(verificationToken.expires, new Date())) {
      await db.delete(schema.verificationTokens).where(eq(schema.verificationTokens.token, token));

      return null;
    }

    await db.delete(schema.verificationTokens).where(eq(schema.verificationTokens.token, token));

    return verificationToken;
  }

  async sendVerificationEmail(user: User, options: { redirect?: string } = {}) {
    const redirect =
      options.redirect && isValidRedirectUrl(options.redirect, [env.APP_URL]) ? options.redirect : undefined;

    const token = await this.createAndStoreVerificationToken(user.id, "email_verification");

    const url = withQuery(joinURL(env.API_URL, "/v1.0/auth/verify-email"), { token, redirect });
    const { html, text } = await renderVerifyEmail({ verifyUrl: url, supportUrl: env.SUPPORT_URL });

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
      supportUrl: env.SUPPORT_URL,
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

  async generateAndStoreRefreshToken(user: User, userAgent: string) {
    const token = crypto.randomBytes(32).toString("hex");
    const expires = addDays(new Date(), 7);

    await db.insert(schema.refreshTokens).values({
      userId: user.id,
      token,
      userAgent,
      expires,
    });

    return { token, expires };
  }

  async verifyAndRotateRefreshToken(refreshToken: string) {
    const token = await db.query.refreshTokens.findFirst({
      where: {
        token: refreshToken,
      },
      with: {
        user: true,
      },
    });

    if (!token || !token.user) {
      return null;
    }

    if (isBefore(token.expires, new Date())) {
      await db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.token, refreshToken));

      return null;
    }

    if (isAfter(new Date(), addYears(token.createdAt, 1))) {
      await db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.token, refreshToken));

      return null;
    }

    const newExpires = addDays(token.expires, 7);
    const newToken = crypto.randomBytes(32).toString("hex");

    await db
      .update(schema.refreshTokens)
      .set({ expires: newExpires, token: newToken })
      .where(eq(schema.refreshTokens.token, refreshToken));

    return { token: newToken, expires: newExpires, user: token.user };
  }

  async deleteRefreshToken(refreshToken: string) {
    await db.delete(schema.refreshTokens).where(eq(schema.refreshTokens.token, refreshToken));
  }

  async verifyAccessToken(accessToken: string) {
    const [error, decoded] = await tryCatch(() => jwt.verify(accessToken, env.JWT_SECRET));

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
