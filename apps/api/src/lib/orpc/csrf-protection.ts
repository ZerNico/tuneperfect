import { type Context, ORPCError } from "@orpc/server";
import type { StandardHandlerOptions, StandardHandlerPlugin } from "@orpc/server/standard";

export interface CsrfProtectionOptions {
  allowedOrigin: string | string[];
}

/**
 * Answered from here rather than thrown: errors thrown in a root interceptor escape oRPC's error
 * handling and reach Bun as a 500, so a blocked request would look like an outage.
 */
function forbidden(message: string) {
  const error = new ORPCError("CSRF_PROTECTION_ERROR", { status: 403, message });
  return { matched: true, response: { status: 403, headers: {}, body: error.toJSON() } } as const;
}

export class CsrfProtectionPlugin<T extends Context> implements StandardHandlerPlugin<T> {
  private readonly options: CsrfProtectionOptions;

  constructor(options: CsrfProtectionOptions) {
    this.options = options;
  }

  init(options: StandardHandlerOptions<T>): void {
    options.rootInterceptors ??= [];

    options.rootInterceptors.unshift(async (options) => {
      if (options.request.method === "GET") {
        return options.next();
      }

      const origin = options.request.headers.origin;
      const referer = options.request.headers.referer;
      const allowedOrigin = Array.isArray(this.options.allowedOrigin)
        ? this.options.allowedOrigin
        : [this.options.allowedOrigin];

      if (origin && typeof origin === "string") {
        if (!allowedOrigin.includes(origin)) {
          return forbidden("Origin not allowed");
        }

        return options.next();
      }

      if (referer && typeof referer === "string") {
        const origin = URL.parse(referer)?.origin;
        if (!origin || !allowedOrigin.includes(origin)) {
          return forbidden("Referer not allowed");
        }

        return options.next();
      }

      return forbidden("No origin or referer header found");
    });
  }
}
