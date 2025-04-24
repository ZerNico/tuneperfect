import { sql } from "drizzle-orm";
import { db } from "../lib/db";
import * as schema from "../lib/db/schema";

export class UserService {
  async getUserByEmail(email: string) {
    return await db.query.users.findFirst({
      where: {
        RAW: (table) => sql`lower(${table.email}) = ${email.toLowerCase()}`,
      },
    });
  }

  async createUser(email: string, password: string) {
    const hashedPassword = await Bun.password.hash(password);

    const [user] = await db.insert(schema.users).values({ email, password: hashedPassword }).returning();

    return user;
  }
}

export const userService = new UserService();
