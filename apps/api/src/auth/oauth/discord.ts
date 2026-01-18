import * as arctic from "arctic";
import { eq } from "drizzle-orm";
import * as v from "valibot";
import { env } from "../../config/env";
import { db } from "../../lib/db";
import * as schema from "../../lib/db/schema";
import type { User } from "../../types";
import { UsernameSchema } from "../../user/models";
import { userService } from "../../user/service";
import { tryCatch } from "../../utils/try-catch";
import { UnverifiedEmailExistsError } from "./google";
import { type DiscordProfile, discordProfileSchema } from "./models";

class DiscordOAuthClient {
  private client = new arctic.Discord(
    env.DISCORD_CLIENT_ID,
    env.DISCORD_CLIENT_SECRET,
    `${env.API_URL}/v1.0/auth/providers/discord/callback`,
  );

  public async getAuthorizationURL() {
    const state = arctic.generateState();
    const codeVerifier = arctic.generateCodeVerifier();
    const [error, url] = await tryCatch(() =>
      this.client.createAuthorizationURL(state, codeVerifier, ["identify", "email"]),
    );
    if (error) {
      throw new Error("Failed to generate Discord authorization URL", { cause: error });
    }
    return { url, state, codeVerifier };
  }

  public async validateAuthorizationCode(code: string, codeVerifier: string) {
    return await this.client.validateAuthorizationCode(code, codeVerifier);
  }

  private async getProfile(token: string) {
    const response = await fetch("https://discord.com/api/users/@me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return null;
    }

    return v.parse(discordProfileSchema, await response.json());
  }

  public async createOrMergeUser(profile: DiscordProfile) {
    if (!profile || !profile.verified) {
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

  public async mergeUser(user: User, profile: DiscordProfile) {
    const mergedUser = { ...user };
    if (!mergedUser.image && profile.avatar) {
      mergedUser.image = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`;
    }

    // If the account wasn't verified, mark it as verified now
    if (!mergedUser.emailVerified) {
      mergedUser.emailVerified = true;
    }

    await db.transaction(async (tx) => {
      const updateData: Partial<typeof schema.users.$inferInsert> = {};
      if (!user.image && profile.avatar) {
        updateData.image = `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`;
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
        provider: "discord",
        providerAccountId: profile.id,
      });
    });

    return mergedUser;
  }

  public async createUser(profile: DiscordProfile) {
    const newUser: typeof schema.users.$inferInsert = {
      email: profile.email,
      emailVerified: true,
      image: profile.avatar ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png` : null,
    };

    const result = v.safeParse(UsernameSchema, profile.username);
    if (result.success) {
      const existingUser = await userService.getUserByUsername(profile.username);
      if (!existingUser) {
        newUser.username = result.output;
      }
    }
    const [error, user] = await tryCatch(
      db.transaction(async (tx) => {
        const [user] = await tx.insert(schema.users).values(newUser).returning();
        if (!user) {
          throw new Error("Failed to create user");
        }
        await tx.insert(schema.oauthAccounts).values({
          userId: user.id,
          provider: "discord",
          providerAccountId: profile.id,
        });
        return user;
      }),
    );
    if (error) {
      throw new Error("Failed to create Discord user", { cause: error });
    }
    return user;
  }

  public async getOrCreateUser(token: string) {
    const profile = await this.getProfile(token);
    if (!profile) {
      return null;
    }

    const user = await userService.getUserByOAuthAccount("discord", profile.id);
    if (!user) {
      return await this.createOrMergeUser(profile);
    }

    return user;
  }
}

export const discordOAuthClient = new DiscordOAuthClient();
