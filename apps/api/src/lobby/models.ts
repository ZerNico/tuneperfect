import * as v from "valibot";

export const LobbyTokenSchema = v.object({
  sub: v.string(),
  exp: v.number(),
  type: v.literal("lobby"),
});

export type LobbyToken = v.InferOutput<typeof LobbyTokenSchema>;
