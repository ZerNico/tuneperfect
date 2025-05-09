import { ORPCError, createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { ClientRetryPlugin } from "@orpc/client/plugins";
import { createORPCSolidQueryUtils } from "@orpc/solid-query";
import type { Client } from "@tuneperfect/api";
import { joinURL } from "ufo";
import { tryCatch } from "../../../api/src/utils/try-catch";

const ORPC_URL = joinURL(import.meta.env.VITE_API_URL ?? "", "/rpc");

const link = new RPCLink({
  url: ORPC_URL,

  fetch: (input, init) => {
    return fetch(input, {
      credentials: "include",
      ...init,
    });
  },

  plugins: [
    new ClientRetryPlugin({
      default: {
        retry: 1,
        retryDelay: 0,
        shouldRetry: async ({ error, path }) => {
          if (path.join("/") === "auth/refreshToken") {
            return false;
          }

          if (error instanceof ORPCError) {
            if (error.status === 401) {
              await tryCatch(client.auth.refreshToken.call());

              return true;
            }
          }
          return false;
        },
      },
    }),
  ],
});

const orpc: Client = createORPCClient(link);
export const client = createORPCSolidQueryUtils(orpc);
