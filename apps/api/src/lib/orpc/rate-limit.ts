import { tryCatch } from "../../utils/try-catch";
import { logger } from "../logger";
import { redis } from "../redis";
import { init } from ".";

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

  const [error, sha] = await tryCatch(redis.scriptLoad(REDIS_SCRIPT) as Promise<string>);

  if (error) {
    logger.error(error, "Failed to load rate limit Redis script");
    return null;
  }

  scriptHash = sha;
  logger.info("Rate limit Redis script loaded successfully");
  return scriptHash;
}

type RateLimitResult = [number, number];

async function executeRateLimit(key: string, limit: number, windowMs: number): Promise<RateLimitResult> {
  const sha = await loadScript();

  // Try EVALSHA first if we have the script hash
  if (sha) {
    const [error, result] = await tryCatch<RateLimitResult, Error>(
      redis.evalSha(sha, {
        keys: [key],
        arguments: [limit.toString(), windowMs.toString()],
      }) as Promise<RateLimitResult>,
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
    redis.eval(REDIS_SCRIPT, {
      keys: [key],
      arguments: [limit.toString(), windowMs.toString()],
    }) as Promise<RateLimitResult>,
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

export const rateLimit = init.middleware(async ({ procedure, next, path, errors, context }) => {
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
    throw errors.RATE_LIMIT({
      message: "Rate limit exceeded",
      data: {
        retryAfter,
      },
    });
  }

  return next();
});
