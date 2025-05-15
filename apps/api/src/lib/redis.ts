import { createClient } from "redis";
import { env } from "../config/env";
import { logger } from "./logger";

export const redis = await createClient({
  url: `redis://${env.REDIS_HOST}:${env.REDIS_PORT}`,
})
  .on("error", (err) => logger.error(err, "Redis Client Error"))
  .connect();
