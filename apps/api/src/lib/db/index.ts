import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { env } from "../../config/env";
import { advisoryLock } from "../../utils/db";
import { tryCatch } from "../../utils/try-catch";
import { logger } from "../logger";
import { relations } from "./relations";
import * as schema from "./schema";

logger.info("Connecting to database");
const client = new SQL(env.POSTGRES_URL);
export const db = drizzle({ client, schema, relations });
export type DB = typeof db;

const MIGRATION_LOCK_ID = 3898613124;
const runMigrations = async () => {
  logger.info("Running migrations");
  const unlock = await advisoryLock(db, MIGRATION_LOCK_ID);
  await tryCatch(migrate(db, { migrationsFolder: "drizzle" }));
  await unlock();
  logger.info("Migrations completed");
};

await runMigrations();
