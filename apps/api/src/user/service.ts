import { eq, sql } from "drizzle-orm";
import sharp from "sharp";

import { authService } from "../auth/service";
import { env } from "../config/env";
import { db } from "../lib/db";
import * as schema from "../lib/db/schema";
import type { UserWithPassword } from "../types";
import { tryCatch } from "../utils/try-catch";

/** Formats a profile picture may be in, as sharp names them. */
const IMAGE_FORMATS = new Set(["png", "jpeg", "webp"]);
/** 4096 × 4096: plenty for a picture shown at 256px. */
const MAX_IMAGE_PIXELS = 4096 * 4096;

export class InvalidImageError extends Error {
  constructor() {
    super("Not a supported image");
  }
}

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

  async getUserByEmailWithPassword(email: string) {
    return await db.query.users.findFirst({
      where: {
        RAW: (table) => sql`lower(${table.email}) = ${email.toLowerCase()}`,
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

  async getUserByIdWithPassword(id: string) {
    return await db.query.users.findFirst({
      where: {
        id,
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

  /** Stores a profile picture as a 256px WebP. Throws `InvalidImageError` for anything that isn't a sane image. */
  async storeUserImage(userId: string, image: File) {
    // The browser's MIME type is only a claim: check what the bytes are before decoding them in full,
    // and refuse huge dimensions (a small file can still claim millions of pixels).
    const input = sharp(await image.arrayBuffer(), { limitInputPixels: MAX_IMAGE_PIXELS });
    const [metadataError, metadata] = await tryCatch(input.metadata());
    if (
      metadataError ||
      !metadata.format ||
      !IMAGE_FORMATS.has(metadata.format) ||
      (metadata.width ?? 0) * (metadata.height ?? 0) > MAX_IMAGE_PIXELS
    ) {
      throw new InvalidImageError();
    }

    const [error, resizedImage] = await tryCatch(
      input
        .resize({ width: 256, height: 256, fit: "cover", position: "center" })
        .webp({
          quality: 80,
          lossless: false,
          effort: 4,
        })
        .toBuffer(),
    );
    if (error) {
      throw new InvalidImageError();
    }

    await Bun.write(`${env.UPLOADS_PATH}/users/${userId}.webp`, resizedImage);
  }
}

export const userService = new UserService();
