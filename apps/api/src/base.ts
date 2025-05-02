import { os, onError } from "@orpc/server";
import { db } from "./lib/db";
import { logger } from "./lib/logger";
import { init } from "./lib/orpc";
import { rateLimit } from "./lib/orpc/rate-limit";

const dbProvider = os.middleware(async ({ next }) => {
  return next({
    context: {
      db,
    },
  });
});

export const base = init
  .use(rateLimit)
  .use(dbProvider)
  .use(
    onError((error) => {
      logger.error(error);
    }),
  )
  .errors({
    INTERNAL_SERVER_ERROR: {
      status: 500,
    },
    RATE_LIMIT_EXCEEDED: {
      status: 429,
      message: "Too many requests, please try again later.",
    },
  });
