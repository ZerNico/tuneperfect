import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { call } from "@orpc/server";

import { expectORPCError, makeUser } from "../../test/helpers";
import type { ORPCContext } from "../lib/orpc";
import { authRouter } from "./router";
import { authService } from "./service";

afterEach(() => {
  mock.restore();
});

/**
 * Minimal cookie-aware context that records setCookie/deleteCookie calls, so we
 * can assert on cookie mutations without a real HTTP server.
 */
function cookieContext(cookies: Record<string, string> = {}) {
  const map = new Bun.CookieMap();
  for (const [name, value] of Object.entries(cookies)) {
    map.set(name, value);
  }

  const setCookie = mock((_name: string, _value: string, _options: Bun.CookieInit) => undefined);
  const deleteCookie = mock((_name: string, _options: Bun.CookieInit) => undefined);

  const context: ORPCContext = {
    cookies: map,
    headers: new Headers(),
    resHeaders: new Headers(),
    setCookie,
    deleteCookie,
  };

  return { context, setCookie, deleteCookie };
}

describe("refreshToken", () => {
  it("clears both cookies and 401s when no refresh token is present", async () => {
    const { context, deleteCookie } = cookieContext();

    await expectORPCError(call(authRouter.refreshToken, undefined, { context }), "UNAUTHORIZED");

    expect(deleteCookie).toHaveBeenCalledTimes(2);
    const cleared = deleteCookie.mock.calls.map((c) => c[0]).sort();
    expect(cleared).toEqual(["access_token", "refresh_token"]);
  });

  it("clears both cookies and 401s when the refresh token is invalid", async () => {
    const { context, deleteCookie, setCookie } = cookieContext({ refresh_token: "stale-token" });
    spyOn(authService, "verifyAndRotateRefreshToken").mockResolvedValue(null);

    await expectORPCError(call(authRouter.refreshToken, undefined, { context }), "UNAUTHORIZED");

    expect(deleteCookie).toHaveBeenCalledTimes(2);
    expect(setCookie).not.toHaveBeenCalled();
  });

  it("rotates the refresh token and sets fresh cookies on success", async () => {
    const user = makeUser();
    const { context, setCookie, deleteCookie } = cookieContext({ refresh_token: "valid-token" });
    spyOn(authService, "verifyAndRotateRefreshToken").mockResolvedValue({
      token: "rotated-refresh-token",
      expires: new Date(Date.now() + 1000 * 60 * 60),
      user: { ...user, password: null },
    });

    await call(authRouter.refreshToken, undefined, { context });

    expect(deleteCookie).not.toHaveBeenCalled();
    const setNames = setCookie.mock.calls.map((c) => c[0]).sort();
    expect(setNames).toEqual(["access_token", "refresh_token"]);

    const refreshCall = setCookie.mock.calls.find((c) => c[0] === "refresh_token");
    expect(refreshCall?.[1]).toBe("rotated-refresh-token");
  });

  it("sets cookie Max-Age in seconds, not milliseconds", async () => {
    const user = makeUser();
    const { context, setCookie } = cookieContext({ refresh_token: "valid-token" });
    spyOn(authService, "verifyAndRotateRefreshToken").mockResolvedValue({
      token: "rotated-refresh-token",
      expires: new Date(Date.now() + 1000 * 60 * 60),
      user: { ...user, password: null },
    });

    await call(authRouter.refreshToken, undefined, { context });

    const refreshCall = setCookie.mock.calls.find((c) => c[0] === "refresh_token");
    const maxAge = (refreshCall?.[2] as Bun.CookieInit).maxAge ?? 0;
    expect(maxAge).toBeGreaterThan(3500);
    expect(maxAge).toBeLessThanOrEqual(3600);

    const accessCall = setCookie.mock.calls.find((c) => c[0] === "access_token");
    const accessMaxAge = (accessCall?.[2] as Bun.CookieInit).maxAge ?? 0;
    // access tokens live 5 minutes
    expect(accessMaxAge).toBeGreaterThan(290);
    expect(accessMaxAge).toBeLessThanOrEqual(300);
  });
});

describe("signOut", () => {
  it("deletes the stored refresh token and clears both cookies", async () => {
    const { context, deleteCookie } = cookieContext({ refresh_token: "to-be-revoked" });
    const deleteSpy = spyOn(authService, "deleteRefreshToken").mockResolvedValue();

    await call(authRouter.signOut, undefined, { context });

    expect(deleteSpy).toHaveBeenCalledWith("to-be-revoked");
    expect(deleteCookie).toHaveBeenCalledTimes(2);
    const cleared = deleteCookie.mock.calls.map((c) => c[0]).sort();
    expect(cleared).toEqual(["access_token", "refresh_token"]);
  });

  it("still clears cookies when there is no refresh token", async () => {
    const { context, deleteCookie } = cookieContext();
    const deleteSpy = spyOn(authService, "deleteRefreshToken");

    await call(authRouter.signOut, undefined, { context });

    expect(deleteSpy).not.toHaveBeenCalled();
    expect(deleteCookie).toHaveBeenCalledTimes(2);
  });
});
