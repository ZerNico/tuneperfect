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

export class UnverifiedEmailExistsError extends Error {
  constructor(message = "An unverified account with this email already exists") {
    super(message);
    this.name = "UnverifiedEmailExistsError";
  }
}

class GoogleOAuthClient {
  private client = new arctic.Google(
    env.GOOGLE_CLIENT_ID,
    env.GOOGLE_CLIENT_SECRET,
    `${env.NODE_ENV === "development" ? "https://fwd.host/" : ""}${env.API_URL}/v1.0/auth/providers/google/callback`,
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
    const user = await userService.getUserByEmailWithPassword(profile.email);
    if (!user) {
      return await this.createUser(profile);
    }
    if (!user.emailVerified) {
      // If unverified account has a password, reject the merge
      if (user.password) {
        throw new UnverifiedEmailExistsError();
      }
      // If no password, proceed with merge (auto-verify and link OAuth)
    }

    return await this.mergeUser(user, profile);
  }

  public async mergeUser(user: User, profile: GoogleProfile) {
    const mergedUser = { ...user };
    const highResImage = getHighResGoogleProfileImage(profile.picture);

    if (!mergedUser.image) {
      mergedUser.image = highResImage;
    }

    // If the account wasn't verified, mark it as verified now
    if (!mergedUser.emailVerified) {
      mergedUser.emailVerified = true;
    }

    await db.transaction(async (tx) => {
      const updateData: Partial<typeof schema.users.$inferInsert> = {};
      if (!user.image) {
        updateData.image = highResImage;
      }
      if (!user.emailVerified) {
        updateData.emailVerified = true;
      }
      if (Object.keys(updateData).length > 0) {
        await tx
          .update(schema.users)
          .set(updateData)
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
    const highResImage = getHighResGoogleProfileImage(profile.picture);

    const [error, user] = await tryCatch(
      db.transaction(async (tx) => {
        const [user] = await tx
          .insert(schema.users)
          .values({
            email: profile.email,
            emailVerified: true,
            image: highResImage,
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

function getHighResGoogleProfileImage(pictureUrl: string | undefined, size = 256): string | null {
  if (!pictureUrl) return null;

  const baseUrl = pictureUrl.replace(/=s\d+-c$/, "");
  return `${baseUrl}=s${size}-c`;
}

export const googleOAuthClient = new GoogleOAuthClient();
