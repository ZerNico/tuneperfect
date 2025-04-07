import * as v from "valibot";

const BaseTokenSchema = v.object({
  sub: v.string(),
  iat: v.number(),
  exp: v.number(),
  iss: v.literal("api"),
  aud: v.literal("api"),
});

export const LobbyTokenSchema = v.object({
  ...BaseTokenSchema.entries,
  type: v.literal("lobby"),
});

export type LobbyToken = v.InferOutput<typeof LobbyTokenSchema>;