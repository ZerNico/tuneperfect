import type { ContractRouterClient, InferContractRouterOutputs } from "@orpc/contract";
import { oc } from "@orpc/contract";
import * as v from "valibot";

import { remoteContract } from "./remote";

export * from "./remote";

export const SongSummarySchema = v.object({
  hash: v.string(),
  title: v.string(),
  artist: v.string(),
  // Optional so the app keeps working with game versions that don't send them yet.
  year: v.optional(v.nullable(v.number())),
  /** When the song was added to the library (ms since epoch), for "newest first". */
  addedAt: v.optional(v.nullable(v.number())),
});

export type SongSummary = v.InferOutput<typeof SongSummarySchema>;

export const listSongsContract = oc.output(v.array(SongSummarySchema));

/** A small JPEG thumbnail of a song's cover as a data URL, or null if it has none. */
export const songCoverContract = oc
  .input(v.object({ hash: v.pipe(v.string(), v.maxLength(64)) }))
  .output(v.object({ dataUrl: v.nullable(v.string()) }));

export const pingContract = oc.output(
  v.object({
    timestamp: v.number(),
    /**
     * Changes whenever the game's song library does, so phones only fetch the song list again when
     * it changed. Optional: older games don't send it.
     */
    libraryVersion: v.optional(v.string()),
    /** What else this game answers, e.g. `REMOTE_FEATURE`. Optional: older games don't send it. */
    features: v.optional(v.array(v.string())),
  }),
);

export const gameContract = {
  ping: pingContract,
  songs: {
    list: listSongsContract,
    cover: songCoverContract,
  },
  /** Only games listing `REMOTE_FEATURE` in `ping` answer these. */
  remote: remoteContract,
};

export type GameContract = typeof gameContract;
export type GameOutputs = InferContractRouterOutputs<GameContract>;
export type GameClient = ContractRouterClient<GameContract>;
