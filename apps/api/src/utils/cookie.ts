import { differenceInSeconds } from "date-fns";
import { env } from "../config/env";

export const defaultCookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
  domain: env.COOKIE_DOMAIN,
} as const;

export function setTokenCookie(type: "access" | "refresh", token: string, expires: Date, resHeaders: Headers) {
  const cookie = new Bun.Cookie(type, token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    expires,
    domain: env.COOKIE_DOMAIN,
  });

  resHeaders.append("set-cookie", cookie.toString());
}

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
