import type { ContractRouterClient, InferContractRouterOutputs } from "@orpc/contract";

// Currently empty - reserved for future bidirectional communication
export const appContract = {};

export type AppContract = typeof appContract;
export type AppOutputs = InferContractRouterOutputs<AppContract>;
export type AppClient = ContractRouterClient<AppContract>;
