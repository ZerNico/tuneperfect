import { createBunHttpHandler, createBunServeHandler } from "trpc-bun-adapter";
import { auth } from "./config/auth";
import { highscoreRouter } from "./modules/highscore/highscore.router";
import { lobbyRouter } from "./modules/lobby/lobby.router";
import { createContext, router } from "./trpc";
import { createCorsHeaders, setCorsHeaders } from "./utils/cors";

const appRouter = router({
  lobby: lobbyRouter,
  highscore: highscoreRouter,
});

export type AppRouter = typeof appRouter;

const bunHandler = createBunHttpHandler({
  router: appRouter,
  endpoint: "/trpc",
  createContext,
  responseMeta(opts) {
    const origin = opts.ctx?.headers.get("origin");

    return {
      headers: {
        ...createCorsHeaders(origin ?? ""),
      },
    };
  },
  batching: {
    enabled: true,
  },
  emitWsUpgrades: false,
});

const server = Bun.serve({
  port: 3002,
  async fetch(request, server) {
    const path = new URL(request.url).pathname;

    if (request.method === "OPTIONS") {
      const response = new Response();
      setCorsHeaders(response, request.headers.get("origin") ?? "");

      return response;
    }

    if (path.startsWith("/api/v1.0/auth")) {
      const response = await auth.handler(request);
      setCorsHeaders(response, request.headers.get("origin") ?? "");

      return response;
    }

    return bunHandler(request, server) ?? new Response("Not found", { status: 404 });
  },
});

console.log(`Server is running on ${server.url}`);
