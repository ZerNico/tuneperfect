import { type Context, ORPCError } from "@orpc/server";
import type { StandardHandlerOptions, StandardHandlerPlugin } from "@orpc/server/standard";

export interface CsrfProtectionOptions {
  allowedOrigin: string | string[];
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
          throw new ORPCError("CSRF_PROTECTION_ERROR", {
            status: 403,
            message: "Origin not allowed",
          });
        }

        return options.next();
      }

      if (referer && typeof referer === "string") {
        const url = new URL(referer);
        const origin = url.origin;
        if (!allowedOrigin.includes(origin)) {
          throw new ORPCError("CSRF_PROTECTION_ERROR", {
            status: 403,
            message: "Referer not allowed",
          });
        }

        return options.next();
      }

      throw new ORPCError("CSRF_PROTECTION_ERROR", {
        status: 403,
        message: "No origin or referer header found",
      });
    });
  }
}
