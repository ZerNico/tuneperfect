import { env } from "bun";
import { eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { authService } from "../auth/service";
import { db } from "../lib/db";
import * as schema from "../lib/db/schema";
import type { User, UserWithPassword } from "../types";

export class UserService {
  async getUserByEmail(email: string) {
    return await db.query.users.findFirst({
      where: {
        RAW: (table) => sql`lower(${table.email}) = ${email.toLowerCase()}`,
      },
      columns: {
        password: false,
      },
    });
  }

  async getUserById(id: string) {
    return await db.query.users.findFirst({
      where: {
        id,
      },
      columns: {
        password: false,
      },
    });
  }

  async getUserByUsername(username: string) {
    return await db.query.users.findFirst({
      where: {
        RAW: (table) => sql`lower(${table.username}) = ${username.toLowerCase()}`,
      },
      columns: {
        password: false,
      },
    });
  }

  async getUserByOAuthAccount(provider: string, providerAccountId: string) {
    return await db.query.users.findFirst({
      where: {
        oauthAccounts: {
          provider,
          providerAccountId,
        },
      },
    });
  }

  async createUser(email: string, password: string) {
    const hashedPassword = await authService.hashPassword(password);

    const [user] = await db.insert(schema.users).values({ email, password: hashedPassword }).returning();

    return user;
  }

  async updateUser(userId: string, data: Partial<UserWithPassword>) {
    const [user] = await db.update(schema.users).set(data).where(eq(schema.users.id, userId)).returning();

    return user;
  }

  async storeUserImage(userId: string, image: File) {
    const resizedImage = await sharp(await image.arrayBuffer())
      .resize({ width: 256, height: 256, fit: "cover", position: "center" })
      .webp({
        quality: 80,
        lossless: false,
        effort: 4,
      })
      .toBuffer();

    await Bun.write(`${env.UPLOADS_PATH}/users/${userId}.webp`, resizedImage);
  }
}

export const userService = new UserService();
