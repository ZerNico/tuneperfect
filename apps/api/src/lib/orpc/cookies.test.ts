import { describe, expect, it, mock } from "bun:test";

import type { Context } from "@orpc/server";
import type { StandardHandlerOptions } from "@orpc/server/standard";

import { defaultCookieOptions } from "../../utils/cookie";
import { CookiesPlugin } from "./cookies";

type RootInterceptor = (options: {
  request: { headers: Record<string, string | undefined> };
  context: Record<string, unknown>;
  next: (options: { context: Record<string, unknown> }) => Promise<unknown>;
}) => Promise<unknown>;

/**
 * Runs the cookies plugin's root interceptor with the given Cookie header and
 * returns the context the inner handler receives plus the response headers.
 */
async function runPlugin(cookieHeader?: string) {
  const plugin = new CookiesPlugin();
  const handlerOptions = { rootInterceptors: [] } as unknown as StandardHandlerOptions<Context>;
  plugin.init(handlerOptions);
  const interceptor = handlerOptions.rootInterceptors?.[0] as unknown as RootInterceptor;

  let innerContext: Record<string, unknown> = {};
  await interceptor({
    request: { headers: { cookie: cookieHeader } },
    context: {},
    next: async (options) => {
      innerContext = options.context;
      return "ok";
    },
  });

  return {
    context: innerContext as {
      cookies: Bun.CookieMap;
      resHeaders: Headers;
      setCookie: (name: string, value: string, options: Bun.CookieInit) => void;
      deleteCookie: (name: string, options: Bun.CookieInit) => void;
    },
  };
}

describe("CookiesPlugin", () => {
  it("parses the request cookie header into a CookieMap", async () => {
    const { context } = await runPlugin("access_token=abc; refresh_token=def");

    expect(context.cookies.get("access_token")).toBe("abc");
    expect(context.cookies.get("refresh_token")).toBe("def");
  });

  it("provides an empty CookieMap when no cookie header is present", async () => {
    const { context } = await runPlugin();

    expect(context.cookies.get("access_token")).toBeNull();
  });

  it("setCookie appends a Set-Cookie header with the secure flags", async () => {
    const { context } = await runPlugin();

    context.setCookie("access_token", "token-value", { ...defaultCookieOptions, maxAge: 300 });

    const setCookie = context.resHeaders.get("set-cookie") ?? "";
    expect(setCookie).toContain("access_token=token-value");
    expect(setCookie.toLowerCase()).toContain("httponly");
    expect(setCookie.toLowerCase()).toContain("secure");
    expect(setCookie.toLowerCase()).toContain("samesite=lax");
  });

  it("deleteCookie appends a Set-Cookie header that expires the cookie", async () => {
    const { context } = await runPlugin();

    context.deleteCookie("access_token", { ...defaultCookieOptions });

    const setCookie = context.resHeaders.get("set-cookie") ?? "";
    expect(setCookie).toContain("access_token=");
    expect(setCookie.toLowerCase()).toMatch(/max-age=0|expires=/);
  });
});
