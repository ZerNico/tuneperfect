import { renderVerifyEmail } from "@tuneperfect/email";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { openAPI } from "better-auth/plugins";
import { sql } from "drizzle-orm";
import { db } from "../db";
import * as schema from "../db/schema";
import { sendEmail } from "../email";
import { env } from "../env";
import { lobby } from "./lobby";
import { username } from "./username";

export const auth = betterAuth({
  appName: "tuneperfect",
  plugins: [openAPI(), username(), lobby()],
  basePath: "/api/v1.0/auth",
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    usePlural: true,
  }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url, token }, request) => {
      const html = await renderVerifyEmail({
        url,
        supportUrl: env.APP_URL,
      });
      const text = await renderVerifyEmail(
        {
          url,
          supportUrl: env.APP_URL,
        },
        { plainText: true },
      );

      await sendEmail(user.email, "Verify your email", html, text);
    },
  },
  socialProviders: {
    discord: {
      clientId: env.DISCORD_CLIENT_ID,
      clientSecret: env.DISCORD_CLIENT_SECRET,
      mapProfileToUser: async (profile) => {
        const existingUser = await db.query.users.findFirst({
          where: {
            RAW: (table) => sql`LOWER(${table.username}) = ${profile.username.toLowerCase()}`,
          },
        });

        if (existingUser) {
          return {
            name: "",
          };
        }

        return {
          username: profile.username,
          name: "",
        };
      },
    },
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      mapProfileToUser: async () => {
        return {
          name: "",
        };
      },
    },
  },
  advanced: {
    crossSubDomainCookies: {
      enabled: true,
      domain: env.COOKIE_DOMAIN,
    },
    defaultCookieAttributes: {
      secure: true,
      httpOnly: true,
      sameSite: "lax",
      partitioned: true,
    },
  },
  trustedOrigins: [env.APP_URL],
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-in/username") {
        throw new APIError("FORBIDDEN", {
          message: "Username sign in is not allowed",
        });
      }
    }),
  },
});
