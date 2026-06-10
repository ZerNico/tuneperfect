import { createClient } from "redis";

import { env } from "../config/env";
import { logger } from "./logger";

// Exported unconnected; the server entry point calls connectRedis() before
// serving so that importing this module has no side effects.
export const redis = createClient({
  url: env.REDIS_URL,
}).on("error", (err) => logger.error(err, "Redis Client Error"));

export async function connectRedis() {
  if (!redis.isOpen) {
    await redis.connect();
  }
}
