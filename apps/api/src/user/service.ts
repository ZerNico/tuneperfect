import { eq, sql } from "drizzle-orm";
import { authService } from "../auth/service";
import { db } from "../lib/db";
import * as schema from "../lib/db/schema";
import type { User } from "../types";

export class UserService {
  async getUserByEmail(email: string) {
    return await db.query.users.findFirst({
      where: {
        RAW: (table) => sql`lower(${table.email}) = ${email.toLowerCase()}`,
      },
    });
  }

  async getByOAuthAccount(provider: string, providerAccountId: string) {
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

  async updateUser(id: string, data: Partial<User>) {
    const [user] = await db.update(schema.users).set(data).where(eq(schema.users.id, id)).returning();

    return user;
  }
}

export const userService = new UserService();
