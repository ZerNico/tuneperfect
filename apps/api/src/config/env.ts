import * as v from "valibot";

const ConfigSchema = v.object({
  NODE_ENV: v.optional(v.picklist(["development", "production"]), "production"),
  PORT: v.optional(
    v.pipe(
      v.string(),
      v.transform((value) => Number.parseInt(value)),
      v.number(),
    ),
    "3000",
  ),
  POSTGRES_URL: v.string(),
  API_URL: v.string(),
  EMAIL_SMTP_URL: v.string(),
  EMAIL_FROM: v.string(),
  SUPPORT_EMAIL: v.string(),
  APP_URL: v.string(),
  JWT_SECRET: v.string(),
  COOKIE_DOMAIN: v.string(),
  GOOGLE_CLIENT_ID: v.string(),
  GOOGLE_CLIENT_SECRET: v.string(),
  DISCORD_CLIENT_ID: v.string(),
  DISCORD_CLIENT_SECRET: v.string(),
  REDIS_URL: v.string(),
  TRUSTED_PROXY_ENABLED: v.optional(
    v.pipe(
      v.string(),
      v.transform((value) => value === "true"),
      v.boolean(),
    ),
    "true",
  ),
  UPLOADS_PATH: v.fallback(v.pipe(v.string(), v.nonEmpty()), "./uploads"),
  VERSION: v.string(),
  /** Last release built with Tauri; installed Tauri versions are only offered this one (none when unset). */
  TAURI_VERSION: v.optional(v.string()),
  /**
   * Platforms (Tauri targets: `darwin`, `linux`, `windows`, or `all`) whose Tauri installs
   * move to Electron, comma-separated. Unset = migration stays off everywhere.
   */
  TAURI_MIGRATION_ENABLED: v.optional(
    v.pipe(
      v.string(),
      v.transform((value) =>
        value
          .split(",")
          .map((target) => target.trim().toLowerCase())
          .filter(Boolean),
      ),
    ),
    "",
  ),
  GITHUB_REPO: v.optional(v.string()),
  STUN_URL: v.optional(v.string(), "stun:stun.l.google.com:19302"),
  /** TURN servers sharing TURN_SECRET, comma-separated (e.g. the same host over UDP and TCP). */
  TURN_URLS: v.optional(
    v.pipe(
      v.string(),
      v.transform((value) =>
        value
          .split(",")
          .map((url) => url.trim())
          .filter(Boolean),
      ),
    ),
    "",
  ),
  /**
   * coturn's `static-auth-secret`: TURN credentials are signed with it and expire (see
   * src/webrtc/service.ts). TURN is only offered when TURN_URLS and TURN_SECRET are both set.
   */
  TURN_SECRET: v.optional(v.pipe(v.string(), v.nonEmpty())),
  /** Seconds a TURN credential can open new relays. Clients refetch hourly, so new connections get at least this minus an hour. */
  TURN_CREDENTIAL_TTL: v.optional(
    v.pipe(v.string(), v.transform(Number), v.number(), v.integer(), v.minValue(7200)),
    "86400",
  ),
  POSTHOG_TOKEN: v.optional(v.string()),
});

const result = v.safeParse(ConfigSchema, process.env);

if (result.issues) {
  console.error(v.summarize(result.issues));
  process.exit(1);
}

export const env = result.output;
