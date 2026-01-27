import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { createORPCSolidQueryUtils } from "@orpc/solid-query";
import type { Client } from "@tuneperfect/api";
import { joinURL } from "ufo";
import { lobbyStore } from "~/stores/lobby";

const ORPC_URL = joinURL(import.meta.env.VITE_API_URL ?? "", "/rpc");

const link = new RPCLink({
  url: ORPC_URL,
  headers: () => {
    const token = lobbyStore.lobby()?.token;

    if (!token) {
      return {};
    }

    return {
      Authorization: `Bearer ${token}`,
    };
  },
});

const orpc: Client = createORPCClient(link);
export const client = createORPCSolidQueryUtils(orpc);

// Export raw client for direct calls (needed for SSE subscriptions)
export const orpcClient = orpc;
