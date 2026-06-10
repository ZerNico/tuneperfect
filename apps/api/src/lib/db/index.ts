import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";

import { env } from "../../config/env";
import { locked } from "../../utils/db";
import { logger } from "../logger";
import { relations } from "./relations";
import * as schema from "./schema";

// Client creation is lazy (no I/O until the first query), so importing this
// module is side-effect free. Migrations run explicitly via runMigrations()
// from the server entry point.
const client = new SQL(env.POSTGRES_URL);
export const db = drizzle({ client, schema, relations });
export type DB = typeof db;

const MIGRATION_LOCK_ID = 3898613124;

export async function runMigrations() {
  await locked(client, MIGRATION_LOCK_ID, async () => {
    logger.info("Running database migrations...");
    await migrate(db, { migrationsFolder: "drizzle" });
    logger.info("Migrations completed successfully");
  });
}
