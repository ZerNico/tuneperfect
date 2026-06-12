import { env } from "../config/env";

export const defaultCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  domain: env.COOKIE_DOMAIN,
} as const;

export function createCookie(name: string, value: string, options: Bun.CookieInit) {
  return new Bun.Cookie(name, value, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    domain: env.COOKIE_DOMAIN,
    ...options,
  });
}

/** Max-Age is specified in seconds (RFC 6265); Dates and getTime() are milliseconds. */
export function cookieMaxAge(expires: Date) {
  return Math.max(0, Math.floor((expires.getTime() - Date.now()) / 1000));
}

// function to create a cookie to delete it on the client side
export function deleteCookie(name: string) {
  return new Bun.Cookie(name, "", {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    domain: env.COOKIE_DOMAIN,
    maxAge: 0,
  });
}
