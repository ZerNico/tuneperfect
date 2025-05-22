import * as v from "valibot";

const ConfigSchema = v.object({
  POSTGRES_URL: v.string(),
  API_URL: v.string(),
  EMAIL_SMTP_URL: v.string(),
  EMAIL_FROM: v.string(),
  SUPPORT_URL: v.string(),
  APP_URL: v.string(),
  JWT_SECRET: v.string(),
  COOKIE_DOMAIN: v.string(),
  GOOGLE_CLIENT_ID: v.string(),
  GOOGLE_CLIENT_SECRET: v.string(),
  DISCORD_CLIENT_ID: v.string(),
  DISCORD_CLIENT_SECRET: v.string(),
  REDIS_URL: v.string(),
  UPLOADS_PATH: v.optional(v.string(), "./uploads"),
});

const result = v.safeParse(ConfigSchema, process.env);

if (result.issues) {
  console.error(v.summarize(result.issues));
  process.exit(1);
}

export const env = result.output;
