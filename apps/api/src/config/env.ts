import * as v from "valibot";

const ConfigSchema = v.object({
  BETTER_AUTH_SECRET: v.string(),
  POSTGRES_URI: v.string(),
  DISCORD_CLIENT_ID: v.string(),
  DISCORD_CLIENT_SECRET: v.string(),
  GOOGLE_CLIENT_ID: v.string(),
  GOOGLE_CLIENT_SECRET: v.string(),
  COOKIE_DOMAIN: v.string(),
  APP_URL: v.string(),
  EMAIL_SMTP_URI: v.string(),
  EMAIL_FROM: v.string(),
  JWT_SECRET: v.string(),
});

export const env = v.parse(ConfigSchema, process.env);
