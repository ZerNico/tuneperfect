import { createClient } from "redis";
import { env } from "../config/env";
import { logger } from "./logger";

export const redis = await createClient({
  url: env.REDIS_URL,
})
  .on("error", (err) => logger.error(err, "Redis Client Error"))
  .connect();
