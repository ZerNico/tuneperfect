import * as arctic from "arctic";
import { eq } from "drizzle-orm";
import * as v from "valibot";
import { env } from "../../config/env";
import { db } from "../../lib/db";
import * as schema from "../../lib/db/schema";
import type { User } from "../../types";
import { userService } from "../../user/service";
import { tryCatch } from "../../utils/try-catch";
import { type GoogleProfile, googleProfileSchema } from "./models";

class GoogleOAuthClient {
  private client = new arctic.Google(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    `https://redirectmeto.com/${env.API_URL}/v1.0/auth/providers/google/callback`,
  );

  public async getAuthorizationURL() {
    const state = arctic.generateState();
    const codeVerifier = arctic.generateCodeVerifier();
    const [error, url] = await tryCatch(() =>
      this.client.createAuthorizationURL(state, codeVerifier, ["openid", "profile", "email"]),
    );
    if (error) {
      throw new Error("Failed to generate Google authorization URL", { cause: error });
    }
    return { url, state, codeVerifier };
  }

  public async validateAuthorizationCode(code: string, codeVerifier: string) {
    return await this.client.validateAuthorizationCode(code, codeVerifier);
  }

  private async getProfile(token: string) {
    const response = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return v.parse(googleProfileSchema, await response.json());
  }

  public async createOrMergeUser(profile: GoogleProfile) {
    if (!profile || !profile.email_verified) {
      return null;
    }
    const user = await userService.getUserByEmail(profile.email);
    if (!user) {
      return await this.createUser(profile);
    }
    if (!user.emailVerified) {
      return null;
    }

    return await this.mergeUser(user, profile);
  }

  public async mergeUser(user: User, profile: GoogleProfile) {
    const mergedUser = { ...user };
    if (!mergedUser.image) {
      mergedUser.image = profile.picture;
    }

    await db.transaction(async (tx) => {
      if (!user.image) {
        await tx
          .update(schema.users)
          .set({
            image: profile.picture,
          })
          .where(eq(schema.users.id, user.id));
      }
      await tx.insert(schema.oauthAccounts).values({
        userId: user.id,
        provider: "google",
        providerAccountId: profile.sub,
      });
    });

    return mergedUser;
  }

  public async createUser(profile: GoogleProfile) {
    const [error, user] = await tryCatch(
      db.transaction(async (tx) => {
        const [user] = await tx
          .insert(schema.users)
          .values({
            email: profile.email,
            emailVerified: true,
            image: profile.picture,
          })
          .returning();
        if (!user) {
          throw new Error("Failed to create user");
        }
        await tx.insert(schema.oauthAccounts).values({
          userId: user.id,
          provider: "google",
          providerAccountId: profile.sub,
        });
        return user;
      }),
    );
    if (error) {
      throw new Error("Failed to create Google user", { cause: error });
    }
    return user;
  }

  public async getOrCreateUser(token: string) {
    const profile = await this.getProfile(token);
    if (!profile) {
      return null;
    }

    const user = await userService.getUserByOAuthAccount("google", profile.sub);
    if (!user) {
      return await this.createOrMergeUser(profile);
    }

    return user;
  }
}

export const googleOAuthClient = new GoogleOAuthClient();
