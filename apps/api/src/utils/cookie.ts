import { differenceInSeconds } from "date-fns";
import { env } from "../config/env";

export function setTokenCookie(type: "access" | "refresh", token: string, expires: Date, resHeaders: Headers) {
  resHeaders.append(
    "Set-Cookie",
    `${type}Token=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${differenceInSeconds(expires, new Date())}; Domain=${env.COOKIE_DOMAIN};`,
  );
}
