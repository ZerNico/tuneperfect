import * as v from "valibot";

// Simplified song for mobile display
export const SongSummarySchema = v.object({
  hash: v.string(),
  title: v.string(),
  artist: v.string(),
});
export type SongSummary = v.InferOutput<typeof SongSummarySchema>;

// WebRTC signaling messages
export const SignalSchema = v.variant("type", [
  v.object({
    type: v.literal("offer"),
    sdp: v.string(),
    from: v.string(), // userId
  }),
  v.object({
    type: v.literal("answer"),
    sdp: v.string(),
    from: v.string(), // lobbyId
    to: v.string(), // userId
  }),
  v.object({
    type: v.literal("ice-candidate"),
    candidate: v.string(),
    from: v.string(),
    to: v.optional(v.string()), // for guest->host, this is empty; for host->guest, this is userId
  }),
]);
export type Signal = v.InferOutput<typeof SignalSchema>;

// Input schema for sendSignal endpoint
export const SendSignalInputSchema = v.object({
  signal: SignalSchema,
  to: v.optional(v.string()), // userId for host->guest, empty for guest->host
});
export type SendSignalInput = v.InferOutput<typeof SendSignalInputSchema>;
