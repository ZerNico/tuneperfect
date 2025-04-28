import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import type { RouterClient } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { CORSPlugin, ResponseHeadersPlugin } from "@orpc/server/plugins";
import { experimental_ValibotToJsonSchemaConverter } from "@orpc/valibot";
import { authRouter } from "./auth/router";
import { env } from "./config/env";
import { logger } from "./lib/logger";

const router = {
  auth: authRouter,
};

const rpcHandler = new RPCHandler(router, {
  plugins: [
    new CORSPlugin({
      origin: [env.APP_URL],
      credentials: true,
      allowHeaders: ["Content-Type", "Authorization"],
      exposeHeaders: ["Content-Type", "Authorization"],
    }),
    new ResponseHeadersPlugin(),
  ],
});

const openAPIHandler = new OpenAPIHandler(router, {
  plugins: [
    new CORSPlugin({
      origin: [env.APP_URL],
      credentials: true,
      allowHeaders: ["Content-Type", "Authorization"],
      exposeHeaders: ["Content-Type", "Authorization"],
    }),
    new ResponseHeadersPlugin(),
  ],
});

const openAPIGenerator = new OpenAPIGenerator({
  schemaConverters: [new experimental_ValibotToJsonSchemaConverter()],
});

const server = Bun.serve({
  port: 3002,
  async fetch(request: Request) {
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
      prefix: "/v1",
      context: {
        headers: request.headers,
      },
    });

    if (openAPIResponse.matched) {
      return openAPIResponse.response;
    }

    const path = new URL(request.url).pathname;

    if (path === "/spec.json") {
      const spec = await openAPIGenerator.generate(router, {
        info: {
          title: "Tune Perfect",
          version: "1.0.0",
        },
        servers: [{ url: "/v1" }],
      });

      return new Response(JSON.stringify(spec), {
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    return new Response("Not found", { status: 404 });
  },
});

logger.info(`Server is running on ${server.url}`);

export type Client = RouterClient<typeof router>;
