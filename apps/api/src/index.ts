import { OpenAPIGenerator } from "@orpc/openapi";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { RPCHandler } from "@orpc/server/fetch";
import { CORSPlugin, ResponseHeadersPlugin } from "@orpc/server/plugins";
import { experimental_ValibotToJsonSchemaConverter } from "@orpc/valibot";
import { authRouter } from "./auth/router";

const router = {
  auth: authRouter,
};

const rpcHandler = new RPCHandler(router, {
  plugins: [new CORSPlugin(), new ResponseHeadersPlugin()],
});

const openAPIHandler = new OpenAPIHandler(router, {
  plugins: [new CORSPlugin(), new ResponseHeadersPlugin()],
});

const openAPIGenerator = new OpenAPIGenerator({
  schemaConverters: [new experimental_ValibotToJsonSchemaConverter()],
});

const server = Bun.serve({
  async fetch(request: Request) {
    const rpcResponse = await rpcHandler.handle(request, {
      prefix: "/rpc",
      context: {},
    });

    if (rpcResponse.matched) {
      return rpcResponse.response;
    }

    const openAPIResponse = await openAPIHandler.handle(request, {
      prefix: "/v1",
      context: {},
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

console.log(`Server is running on ${server.url}`);
