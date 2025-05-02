import Redis from "ioredis";
import { env } from "../config/env";
import { logger } from "./logger";

export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
});

redis.on("error", (error) => {
  logger.error(error, "Redis connection error");
});

redis.on("connect", () => {
  logger.info("Redis connected");
});
