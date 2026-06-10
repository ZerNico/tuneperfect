import { describe, expect, it, mock } from "bun:test";

import { type Context, ORPCError } from "@orpc/server";
import type { StandardHandlerOptions } from "@orpc/server/standard";

import { CsrfProtectionPlugin } from "./csrf-protection";

const ALLOWED = "https://app.test.localhost";

type Interceptor = (options: {
  request: { method: string; headers: Record<string, string | undefined> };
  next: () => Promise<unknown>;
}) => Promise<unknown>;

function createInterceptor(allowedOrigin: string | string[] = ALLOWED): Interceptor {
  const plugin = new CsrfProtectionPlugin({ allowedOrigin });
  const handlerOptions = { rootInterceptors: [] } as unknown as StandardHandlerOptions<Context>;
  plugin.init(handlerOptions);
  return handlerOptions.rootInterceptors?.[0] as unknown as Interceptor;
}

function run(interceptor: Interceptor, method: string, headers: Record<string, string | undefined> = {}) {
  const next = mock(async () => "passed");
  return { result: interceptor({ request: { method, headers }, next }), next };
}

describe("CsrfProtectionPlugin", () => {
  it("lets GET requests through without headers", async () => {
    const interceptor = createInterceptor();
    const { result, next } = run(interceptor, "GET");

    expect(await result).toBe("passed");
    expect(next).toHaveBeenCalled();
  });

  it("lets POST requests with an allowed origin through", async () => {
    const interceptor = createInterceptor();
    const { result } = run(interceptor, "POST", { origin: ALLOWED });

    expect(await result).toBe("passed");
  });

  it("rejects POST requests from a disallowed origin", async () => {
    const interceptor = createInterceptor();
    const { result } = run(interceptor, "POST", { origin: "https://evil.com" });

    expect(result).rejects.toBeInstanceOf(ORPCError);
    await result.catch((error: ORPCError<string, unknown>) => {
      expect(error.status).toBe(403);
    });
  });

  it("falls back to the referer header when origin is missing", async () => {
    const interceptor = createInterceptor();
    const { result } = run(interceptor, "POST", { referer: `${ALLOWED}/some/page?q=1` });

    expect(await result).toBe("passed");
  });

  it("rejects a disallowed referer", async () => {
    const interceptor = createInterceptor();
    const { result } = run(interceptor, "POST", { referer: "https://evil.com/page" });

    expect(result).rejects.toBeInstanceOf(ORPCError);
  });

  it("rejects requests without origin or referer", async () => {
    const interceptor = createInterceptor();
    const { result } = run(interceptor, "POST");

    expect(result).rejects.toBeInstanceOf(ORPCError);
  });

  it("supports multiple allowed origins", async () => {
    const interceptor = createInterceptor([ALLOWED, "tauri://localhost"]);
    const { result } = run(interceptor, "POST", { origin: "tauri://localhost" });

    expect(await result).toBe("passed");
  });

  it("does not allow origin prefix tricks", async () => {
    const interceptor = createInterceptor();
    const { result } = run(interceptor, "POST", { origin: `${ALLOWED}.evil.com` });

    expect(result).rejects.toBeInstanceOf(ORPCError);
  });
});
