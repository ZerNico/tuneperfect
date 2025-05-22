import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import type { DB } from "../lib/db";

export function lower(email: AnyPgColumn): SQL {
  return sql`lower(${email})`;
}

export async function advisoryLock(db: DB, lockId: number) {
  await db.execute(sql`SELECT pg_advisory_lock(${lockId}) as acquired`);
  return () => db.execute(sql`SELECT pg_advisory_unlock(${lockId}) as acquired`);
}
