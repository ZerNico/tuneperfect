import * as v from "valibot";
import { init } from ".";
import { tryCatch } from "../../utils/try-catch";
import { logger } from "../logger";
import { redis } from "../redis";

export interface RateLimitMetadata {
  rateLimit: {
    windowMs: number;
    limit: number;
  };
}

const REDIS_SCRIPT = `
local key = KEYS[1]
local limit = tonumber(ARGV[1])
local windowMs = tonumber(ARGV[2])

local current = redis.call("INCR", key)

if current == 1 then
  redis.call("PEXPIRE", key, windowMs)
end

return { current, redis.call("PTTL", key) }
`;

let scriptHash: string | null = null;

async function loadScript(): Promise<string | null> {
  if (scriptHash) {
    return scriptHash;
  }

  const [error, sha] = await tryCatch(redis.script("LOAD", REDIS_SCRIPT) as Promise<string>);

  if (error) {
    logger.error(error, "Failed to load rate limit Redis script");
    return null;
  }

  scriptHash = sha;
  logger.info("Rate limit Redis script loaded successfully");
  return sha;
}

type RateLimitResult = [number, number];

async function executeRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const sha = await loadScript();
  const scriptArgs = [
    1, // Number of keys
    key,
    limit.toString(),
    windowMs.toString(),
  ] as const;

  // Try EVALSHA first if we have the script hash
  if (sha) {
    const [error, result] = await tryCatch<RateLimitResult, Error>(
      redis.evalsha(sha, ...scriptArgs) as Promise<RateLimitResult>,
    );

    if (!error) {
      return result;
    }

    if (error.message.includes("NOSCRIPT")) {
      // Script was evicted, reset hash
      scriptHash = null;
    } else {
      throw error;
    }
  }

  // Fallback to EVAL
  const [error, result] = await tryCatch<RateLimitResult, Error>(
    redis.eval(REDIS_SCRIPT, ...scriptArgs) as Promise<RateLimitResult>,
  );

  if (error) {
    throw error;
  }

  return result;
}

function applyRateLimitHeaders(
  context: { resHeaders?: Headers },
  limit: number,
  remaining: number,
  reset: number,
  windowMs: number,
) {
  context.resHeaders?.set("RateLimit-Limit", limit.toString());
  context.resHeaders?.set("RateLimit-Remaining", remaining.toString());
  context.resHeaders?.set("RateLimit-Reset", reset.toString()); // Seconds until window reset
  context.resHeaders?.set("RateLimit-Policy", `${limit};w=${Math.ceil(windowMs / 1000)}`); // Policy with window size in seconds
}

export const rateLimit = init
  .errors({
    RATE_LIMIT_EXCEEDED: {
      status: 429,
      message: "Rate limit exceeded",
      data: v.object({
        retryAfter: v.number(),
      }),
    },
  })
  .middleware(async ({ procedure, next, path, errors, context }) => {
    const rateLimitMeta = procedure["~orpc"].meta.rateLimit;
    const windowMs = rateLimitMeta?.windowMs;
    const limit = rateLimitMeta?.limit;

    const ip = context.headers?.get("x-forwarded-for") ?? context.headers?.get("x-real-ip") ?? "unknown";
    const key = `rate-limit:${path.join(":")}:${ip}`;

    const [current, ttl] = await executeRateLimit(key, limit, windowMs);

    const remaining = Math.max(0, limit - current);
    const reset = Math.ceil(ttl / 1000);
    const retryAfter = reset;

    applyRateLimitHeaders(context, limit, remaining, reset, windowMs);

    if (current > limit) {
      context.resHeaders?.set("Retry-After", retryAfter.toString());
      /*throw errors.RATE_LIMIT_EXCEEDED({
        message: "Rate limit exceeded",
        data: {
          retryAfter,
        },
      });*/
    }

    return next();
  });
