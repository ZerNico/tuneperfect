import crypto from "node:crypto";
import { renderVerifyEmail } from "@tuneperfect/email";
import { addHours } from "date-fns";
import { joinURL, withQuery } from "ufo";
import { env } from "../config/env";
import { db } from "../lib/db";
import * as schema from "../lib/db/schema";
import { sendEmail } from "../lib/email";
import type { User } from "../types";

class AuthService {
  async createAndStoreVerificationToken(userId: string, type: "email_verification" | "password_reset") {
    const token = crypto.randomBytes(32).toString("hex");
    const hashedToken = await Bun.password.hash(token);
    const expires = addHours(new Date(), 1);

    await db.insert(schema.verificationTokens).values({
      userId,
      token: hashedToken,
      type,
      expires,
    });

    return token;
  }

  async sendVerificationEmail(user: User) {
    const token = await this.createAndStoreVerificationToken(user.id, "email_verification");

    const url = withQuery(joinURL(env.API_URL, "/auth/verify-email"), { token });
    const { html, text } = await renderVerifyEmail({ verifyUrl: url, supportUrl: env.SUPPORT_URL });

    await sendEmail(user.email, "Verify your E-Mail", html, text);
  }
}

export const authService = new AuthService();
