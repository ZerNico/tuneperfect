import type { SQL as BunSQL } from "bun";
import type { SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { logger } from "../lib/logger";


export function lower(email: AnyPgColumn): SQL {
  return sql`lower(${email})`;
}

export async function locked<T>(
  client: BunSQL,
  lockId: number,
  callback: () => Promise<T>
): Promise<T> {
  const reservedClient = await client.reserve();
  
  try {
    await reservedClient`SELECT pg_advisory_lock(${lockId})`;
    const result = await callback();
    return result;
    
  } finally {
    try {
      await reservedClient`SELECT pg_advisory_unlock(${lockId})`;
    } catch (error) {
      logger.warn(`Failed to release advisory lock ${lockId}:`, error);
    }
    
    reservedClient.release();
  }
} 