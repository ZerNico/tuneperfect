import { TRPCClientError, httpBatchLink } from "@trpc/client";
import { createTRPCClient } from "@trpc/client";
import type { AppRouter } from "@tuneperfect/api";
import { joinURL } from "ufo";

export const trpc = createTRPCClient<AppRouter>({
  links: [
    httpBatchLink({
      url: joinURL(import.meta.env.VITE_API_URL, "/trpc"),
      fetch(url, options) {
        return fetch(url, {
          ...options,
          credentials: "include",
        });
      },
    }),
  ],
});

export function isTRPCClientError(error: unknown): error is TRPCClientError<AppRouter> {
  return error instanceof TRPCClientError;
}
