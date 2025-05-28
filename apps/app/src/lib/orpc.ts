import { ORPCError, createORPCClient } from "@orpc/client";
import { safe } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { ClientRetryPlugin } from "@orpc/client/plugins";
import { createORPCSolidQueryUtils } from "@orpc/solid-query";
import type { Client } from "@tuneperfect/api";
import { joinURL } from "ufo";
import { config } from "./config";

const ORPC_URL = joinURL(config.API_URL, "/rpc");

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
              const [refreshError, result, isDefined] = await safe(client.auth.refreshToken.call());

              if (refreshError) {
                window.dispatchEvent(new CustomEvent("session:expired"));

                return false;
              }

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
