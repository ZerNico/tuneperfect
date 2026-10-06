import * as v from "valibot";

export const GoodbyeReasonSchema = v.picklist(["user_left", "lobby_closed", "timeout", "error"]);
export type GoodbyeReason = v.InferOutput<typeof GoodbyeReasonSchema>;

// Limits keep a misbehaving client from pushing huge payloads through the API. An SDP for a
// data-channel-only connection is a few KB; a candidate a few hundred bytes.
const IdSchema = v.pipe(v.string(), v.maxLength(128));
const SdpSchema = v.pipe(v.string(), v.maxLength(65_536));
const CandidateSchema = v.pipe(v.string(), v.maxLength(4_096));
/**
 * One connection attempt of a phone. The phone sends a new one with every offer and the game
 * echoes it, so signals of an older attempt can't be mixed into a newer one. Optional: older
 * games and phones don't send it.
 */
const SessionSchema = v.optional(v.pipe(v.string(), v.maxLength(64)));

export const SignalSchema = v.variant("type", [
  v.object({
    type: v.literal("offer"),
    sdp: SdpSchema,
    from: IdSchema,
    session: SessionSchema,
  }),
  v.object({
    type: v.literal("answer"),
    sdp: SdpSchema,
    from: IdSchema,
    to: IdSchema,
    session: SessionSchema,
  }),
  v.object({
    type: v.literal("ice-candidate"),
    candidate: CandidateSchema,
    from: IdSchema,
    to: v.optional(IdSchema),
    session: SessionSchema,
  }),
  v.object({
    type: v.literal("goodbye"),
    from: IdSchema,
    reason: v.optional(GoodbyeReasonSchema),
    session: SessionSchema,
  }),
]);
export type Signal = v.InferOutput<typeof SignalSchema>;

export const SendSignalInputSchema = v.object({
  signal: SignalSchema,
  to: v.optional(IdSchema),
});
export type SendSignalInput = v.InferOutput<typeof SendSignalInputSchema>;
