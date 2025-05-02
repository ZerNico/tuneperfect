import { os } from "@orpc/server";
import type { ResponseHeadersPluginContext } from "@orpc/server/plugins";
import type { CookiesPluginContext } from "./cookies";
import type { RateLimitMetadata } from "./rate-limit";

export interface ORPCContext extends ResponseHeadersPluginContext, CookiesPluginContext {
  headers?: Headers;
}

interface ORPCMetadata extends RateLimitMetadata {}

export const init = os.$meta<ORPCMetadata>({
  rateLimit: {
    windowMs: 1000 * 60 * 5,
    limit: 1000,
  },
}).$context<ORPCContext>();
