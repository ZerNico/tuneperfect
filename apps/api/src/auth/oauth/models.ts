import * as v from "valibot";

export const googleProfileSchema = v.object({
  email: v.string(),
  sub: v.string(),
  picture: v.string(),
  email_verified: v.boolean(),
});

export type GoogleProfile = v.InferOutput<typeof googleProfileSchema>;

export const discordProfileSchema = v.object({
  id: v.string(),
  username: v.string(),
  discriminator: v.string(),
  global_name: v.nullable(v.string()),
  avatar: v.nullable(v.string()),
  email: v.string(),
  verified: v.boolean(),
});

export type DiscordProfile = v.InferOutput<typeof discordProfileSchema>;
