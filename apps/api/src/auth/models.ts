import * as v from "valibot";

export const AccessTokenSchema = v.object({
  sub: v.string(),
  exp: v.number(),
  type: v.literal("access"),
});

export type AccessToken = v.InferOutput<typeof AccessTokenSchema>;
