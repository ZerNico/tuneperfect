import { TRPCClientError, httpBatchLink } from "@trpc/client";
import { createTRPCClient } from "@trpc/client";
import type { AppRouter } from "@tuneperfect/api";
import { joinURL } from "ufo";
import { lobbyStore } from "~/stores/lobby";

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: joinURL(import.meta.env.VITE_API_URL, "/trpc"),
      headers: () => {
        const token = lobbyStore.lobby()?.token;

        if (!token) {
          return {};
        }

        return {
          Authorization: `Bearer ${token}`,
        };
      },
    }),
  ],
});

export const TRPCError = TRPCClientError<AppRouter>;
