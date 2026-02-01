import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import type { RouterClient } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { CORSPlugin, ResponseHeadersPlugin, StrictGetMethodPlugin } from "@orpc/server/plugins";
import { experimental_ValibotToJsonSchemaConverter } from "@orpc/valibot";
import { authRouter } from "./auth/router";
import { clubRouter } from "./club/router";
import { env } from "./config/env";
import { highscoreRouter } from "./highscore/router";
import { setupJobs } from "./lib/jobs";
import { logger } from "./lib/logger";
import { CookiesPlugin } from "./lib/orpc/cookies";
import { CsrfProtectionPlugin } from "./lib/orpc/csrf-protection";
import { lobbyRouter } from "./lobby/router";
import { signalingRouter } from "./signaling/router";
import { updateRouter } from "./update/router";
import { userRouter } from "./user/router";
import { webrtcRouter } from "./webrtc/router";

const router = {
  auth: authRouter,
  user: userRouter,
  lobby: lobbyRouter,
  highscore: highscoreRouter,
  update: updateRouter,
  club: clubRouter,
  signaling: signalingRouter,
  webrtc: webrtcRouter,
};

setupJobs();

const allowedOrigins = [env.APP_URL, "http://localhost:1420", "tauri://localhost", "http://tauri.localhost"];

const plugins = [
  new CORSPlugin({
    origin: (origin) => {
      if (allowedOrigins.includes(origin)) {
        return origin;
      }

      return allowedOrigins[0];
    },
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Type", "Authorization"],
  }),
  new ResponseHeadersPlugin(),
  new CsrfProtectionPlugin({
    allowedOrigin: allowedOrigins,
  }),
  new StrictGetMethodPlugin(),
  new CookiesPlugin(),
];

const rpcHandler = new RPCHandler(router, {
  plugins,
});

const openAPIHandler = new OpenAPIHandler(router, {
  plugins: [
    ...plugins,
    new OpenAPIReferencePlugin({
      schemaConverters: [new experimental_ValibotToJsonSchemaConverter()],
      specGenerateOptions: {
        info: {
          title: "Tune Perfect",
          version: "1.0.0",
        },
        servers: [{ url: "/v1.0" }],
      },
      docsConfig: {
        url: "/v1.0/spec.json",
      },
    }),
  ],
});

const server = Bun.serve({
  port: env.PORT,
  async fetch(request) {
    const rpcResponse = await rpcHandler.handle(request, {
      prefix: "/rpc",
      context: {
        headers: request.headers,
      },
    });

    if (rpcResponse.matched) {
      return rpcResponse.response;
    }

    const openAPIResponse = await openAPIHandler.handle(request, {
      prefix: "/v1.0",
      context: {
        headers: request.headers,
      },
    });

    if (openAPIResponse.matched) {
      return openAPIResponse.response;
    }

    const path = new URL(request.url).pathname;
    if (path === "/") {
      return new Response("Hello World", { status: 200 });
    }

    return new Response("Not found", { status: 404 });
  },
});

logger.info(`Server is running on ${server.url}`);

export type Client = RouterClient<typeof router>;
