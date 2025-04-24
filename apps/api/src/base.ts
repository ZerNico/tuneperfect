import { os } from "@orpc/server";
import type { ResponseHeadersPluginContext } from "@orpc/server/plugins";
import { db } from "./lib/db";

interface ORPCContext extends ResponseHeadersPluginContext {}

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
  .errors({
    INTERNAL_SERVER_ERROR: {
      status: 500,
    },
  });
