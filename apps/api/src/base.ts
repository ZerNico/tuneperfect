import { os, onError } from "@orpc/server";
import type { ResponseHeadersPluginContext } from "@orpc/server/plugins";
import { db } from "./lib/db";
import { logger } from "./lib/logger";
import type { CookiesPluginContext } from "./lib/orpc/cookies";

interface ORPCContext extends ResponseHeadersPluginContext, CookiesPluginContext {
  headers?: Headers;
}

const dbProvider = os.middleware(async ({ next }) => {
  return next({
    context: {
      db,
    },
  });
});

export const base = os
  .$context<ORPCContext>()
  .use(dbProvider)
  .use(
    onError((err) => {
      logger.error({ err });
    }),
  )
  .errors({
    INTERNAL_SERVER_ERROR: {
      status: 500,
    },
  });
