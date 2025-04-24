import * as v from "valibot";

const ConfigSchema = v.object({
  POSTGRES_URL: v.string(),
  API_URL: v.string(),
  EMAIL_SMTP_URL: v.string(),
  EMAIL_FROM: v.string(),
  SUPPORT_URL: v.string(),
});

export const env = v.parse(ConfigSchema, process.env);
