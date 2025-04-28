import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { Client } from "@tuneperfect/api";
import { joinURL } from "ufo";

const ORPC_URL = joinURL(import.meta.env.VITE_API_URL, "/rpc");

const link = new RPCLink({
  url: ORPC_URL,
  headers: () => ({
    authorization: "Bearer token",
  }),
  fetch: (input, init) => {
    return fetch(input, {
      credentials: "include",
      ...init
    });
  },
});

export const client: Client = createORPCClient(link);
