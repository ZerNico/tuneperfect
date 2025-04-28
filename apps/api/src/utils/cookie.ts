import { differenceInSeconds } from "date-fns";
import { env } from "../config/env";

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
