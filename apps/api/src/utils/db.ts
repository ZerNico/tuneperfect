import type { SQL as BunSQL } from "bun";
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

import { logger } from "../lib/logger";

export function lower(email: AnyPgColumn): SQL {
  return sql`lower(${email})`;
}

export async function locked<T>(client: BunSQL, lockId: number, callback: () => Promise<T>): Promise<T> {
  const reservedClient = await client.reserve();

  try {
    await reservedClient`SELECT pg_advisory_lock(${lockId})`;
    const result = await callback();
    return result;
  } finally {
    try {
      await reservedClient`SELECT pg_advisory_unlock(${lockId})`;
    } catch (error) {
      logger.warn(error, `Failed to release advisory lock ${lockId}`);
    }

    reservedClient.release();
  }
}

/** Whether a query failed on a unique constraint (Postgres 23505), also when Drizzle wrapped the driver's error. */
export function isUniqueViolation(error: unknown): boolean {
  let current = error;
  for (let depth = 0; current && depth < 5; depth++) {
    const { errno, code } = current as { errno?: unknown; code?: unknown };
    if (errno === "23505" || code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
