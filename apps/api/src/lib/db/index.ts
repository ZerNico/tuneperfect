import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { env } from "../../config/env";
import { advisoryLock } from "../../utils/db";
import { relations } from "./relations";
import * as schema from "./schema";

const client = new SQL(env.POSTGRES_URL);
export const db = drizzle({ client, schema, relations });
export type DB = typeof db;

const MIGRATION_LOCK_ID = 3898613124;
const runMigration = async () => {
  const unlock = await advisoryLock(db, MIGRATION_LOCK_ID);
  await migrate(db, { migrationsFolder: "drizzle" });
  await unlock();
};

await runMigration();
