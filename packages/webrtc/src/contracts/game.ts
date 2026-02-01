import type { ContractRouterClient, InferContractRouterOutputs } from "@orpc/contract";
import { oc } from "@orpc/contract";
import * as v from "valibot";

export const SongSummarySchema = v.object({
  hash: v.string(),
  title: v.string(),
  artist: v.string(),
});

export type SongSummary = v.InferOutput<typeof SongSummarySchema>;

export const listSongsContract = oc.output(v.array(SongSummarySchema));

export const pingContract = oc.output(v.object({ timestamp: v.number() }));

export const gameContract = {
  ping: pingContract,
  songs: {
    list: listSongsContract,
  },
};

export type GameContract = typeof gameContract;
export type GameOutputs = InferContractRouterOutputs<GameContract>;
export type GameClient = ContractRouterClient<GameContract>;
