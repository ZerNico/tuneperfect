import type { StandardHandlerOptions, StandardHandlerPlugin } from "@orpc/server/standard";

export interface CookiesPluginContext {
  cookies?: Bun.CookieMap;
  resHeaders?: Headers;
  setCookie?: (name: string, value: string, options: Bun.CookieInit) => void;
  deleteCookie?: (name: string, options: Bun.CookieInit) => void;
}

export class CookiesPlugin<T extends CookiesPluginContext> implements StandardHandlerPlugin<T> {
  init(options: StandardHandlerOptions<T>): void {
    options.rootInterceptors ??= [];

    options.rootInterceptors.unshift(async (options) => {
      const cookieHeader = typeof options.request.headers.cookie === "string" ? options.request.headers.cookie : undefined;
      const resHeaders = options.context.resHeaders ?? new Headers();

      const result = await options.next({
        ...options,
        context: {
          ...options.context,
          resHeaders,
          cookies: options.context.cookies ?? new Bun.CookieMap(cookieHeader),
          setCookie: (name, value, options) => {
            const cookie = new Bun.Cookie(name, value, options);
            resHeaders.append("Set-Cookie", cookie.serialize());
          },
          deleteCookie: (name, options) => {
            const cookie = new Bun.Cookie(name, "", {
              ...options,
              maxAge: 0,
            });
            resHeaders.append("Set-Cookie", cookie.serialize());
          },
        },
      });

      return result;
    });
  }
}
