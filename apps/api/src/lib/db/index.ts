import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { env } from "../../config/env";
import { relations } from "./relations";
import * as schema from "./schema";

const client = new SQL(env.POSTGRES_URL);
export const db = drizzle({ client, schema, relations });

await migrate(db, { migrationsFolder: "drizzle" });
