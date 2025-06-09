import { ORPCError, createORPCClient } from "@orpc/client";
import { safe } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import { ClientRetryPlugin } from "@orpc/client/plugins";
import { createTanstackQueryUtils } from "@orpc/tanstack-query";
import type { Client } from "@tuneperfect/api";
import { joinURL } from "ufo";
import { config } from "./config";

const ORPC_URL = joinURL(config.API_URL, "/rpc");

let refreshPromise: Promise<boolean> | null = null;

async function attemptTokenRefresh(): Promise<boolean> {
  if (refreshPromise) {
    return await refreshPromise;
  }

  refreshPromise = (async (): Promise<boolean> => {
    try {
      const [refreshError] = await safe(client.auth.refreshToken.call());
      if (refreshError) {
        window.dispatchEvent(new CustomEvent("session:expired"));
        return false;
      }
      return true;
    } finally {
      refreshPromise = null;
    }
  })();

  return await refreshPromise;
}

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
        shouldRetry: async ({ error, path }): Promise<boolean> => {
          if (path.join("/") === "auth/refreshToken") {
            return false;
          }

          if (error instanceof ORPCError && error.status === 401) {
            return await attemptTokenRefresh();
          }

          return false;
        },
      },
    }),
  ],
});

const orpc: Client = createORPCClient(link);
export const client = createTanstackQueryUtils(orpc);
