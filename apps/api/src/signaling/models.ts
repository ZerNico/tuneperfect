import * as v from "valibot";

export const GoodbyeReasonSchema = v.picklist(["user_left", "lobby_closed", "timeout", "error"]);
export type GoodbyeReason = v.InferOutput<typeof GoodbyeReasonSchema>;

export const SignalSchema = v.variant("type", [
  v.object({
    type: v.literal("offer"),
    sdp: v.string(),
    from: v.string(),
  }),
  v.object({
    type: v.literal("answer"),
    sdp: v.string(),
    from: v.string(),
    to: v.string(),
  }),
  v.object({
    type: v.literal("ice-candidate"),
    candidate: v.string(),
    from: v.string(),
    to: v.optional(v.string()),
  }),
  v.object({
    type: v.literal("goodbye"),
    from: v.string(),
    reason: v.optional(GoodbyeReasonSchema),
  }),
]);
export type Signal = v.InferOutput<typeof SignalSchema>;

export const SendSignalInputSchema = v.object({
  signal: SignalSchema,
  to: v.optional(v.string()),
});
export type SendSignalInput = v.InferOutput<typeof SendSignalInputSchema>;
