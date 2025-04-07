import { env } from "../config/env";

function isOriginAllowed(origin: string) {
  return origin === env.APP_URL || origin === "http://localhost:1420";
}

export function createCorsHeaders(origin: string) {
  return {
    "Access-Control-Allow-Origin": isOriginAllowed(origin) ? origin : env.APP_URL,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "86400",
  };
}

export function setCorsHeaders(res: Response, origin: string) {
  const headers = createCorsHeaders(origin);
  for (const [key, value] of Object.entries(headers)) {
    res.headers.set(key, value);
  }
}
