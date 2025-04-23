import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../../config/db";
import * as schema from "../../config/db/schema";
import { env } from "../../config/env";

class UserService {
  async update(userId: string, user: Partial<typeof schema.users.$inferSelect>) {
    const { id: _, ...userWithoutId } = user;

    const [updatedUser] = await db
      .update(schema.users)
      .set(userWithoutId)
      .where(eq(schema.users.id, userId))
      .returning();

    return updatedUser;
  }

  async uploadImage(userId: string, file: File) {
    const buffer = await file.arrayBuffer();
    const filename = `${userId}-${Date.now()}.${file.name.split(".").pop()}`;
    const path = join(env.UPLOADS_DIR, filename);

    await writeFile(path, Buffer.from(buffer));

    return `/uploads/${filename}`;
  }
}

export const userService = new UserService();
