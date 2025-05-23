import { SQL } from "bun";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import { env } from "../../config/env";
import { logger } from "../logger";
import { relations } from "./relations";
import * as schema from "./schema";

logger.info("Connecting to database");
const client = new SQL(env.POSTGRES_URL);
export const db = drizzle({ client, schema, relations });
export type DB = typeof db;

await migrate(db, { migrationsFolder: "drizzle" });
