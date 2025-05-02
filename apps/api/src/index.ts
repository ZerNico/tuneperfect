import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { OpenAPIReferencePlugin } from "@orpc/openapi/plugins";
import type { RouterClient } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { CORSPlugin, ResponseHeadersPlugin, StrictGetMethodPlugin } from "@orpc/server/plugins";
import { experimental_ValibotToJsonSchemaConverter } from "@orpc/valibot";
import { authRouter } from "./auth/router";
import { env } from "./config/env";
import { logger } from "./lib/logger";
import { CookiesPlugin } from "./lib/orpc/cookies";
import { CsrfProtectionPlugin } from "./lib/orpc/csrf-protection";

const router = {
  auth: authRouter,
};

const plugins = [
  new CORSPlugin({
    origin: [env.APP_URL],
    credentials: true,
    allowHeaders: ["Content-Type", "Authorization"],
    exposeHeaders: ["Content-Type", "Authorization"],
  }),
  new ResponseHeadersPlugin(),
  new CsrfProtectionPlugin({
    allowedOrigin: env.APP_URL,
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
  port: 3002,
  async fetch(request, server) {
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

    return new Response("Not found", { status: 404 });
  },
});

logger.info(`Server is running on ${server.url}`);

export type Client = RouterClient<typeof router>;
