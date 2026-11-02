import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { OpenAPIHandler } from "@orpc/openapi/fetch";

import { env } from "../config/env";
import { updateRouter } from "./router";
import { updateService } from "./service";

/**
 * Released games call these REST paths with plain fetch, whatever RPC protocol the API
 * speaks later, so the paths, statuses and bodies are pinned here over raw HTTP.
 */
const handler = new OpenAPIHandler({ update: updateRouter });
const original = { VERSION: env.VERSION };

async function get(path: string) {
  const request = new Request(`https://api.test.localhost/v1.0${path}`);
  const { response } = await handler.handle(request, {
    prefix: "/v1.0",
    context: { headers: request.headers, cookies: new Bun.CookieMap(), resHeaders: new Headers() },
  });
  return response!;
}

afterEach(() => {
  mock.restore();
  Object.assign(env, original);
});

describe("GET /updates/game-support/{currentVersion}", () => {
  it("answers whether the game is still meant to go online", async () => {
    const support = spyOn(updateService, "isGameSupported").mockReturnValue(false);

    const outdated = await get("/updates/game-support/0.5.0");
    expect(outdated.status).toBe(200);
    expect(await outdated.json()).toEqual({ supported: false });
    expect(support).toHaveBeenCalledWith(expect.objectContaining({ currentVersion: "0.5.0" }));

    support.mockReturnValue(true);
    expect(await (await get("/updates/game-support/0.6.0")).json()).toEqual({ supported: true });
  });
});

describe("GET /updates/electron/{target}/{arch}/{currentVersion}", () => {
  it("answers 204 without an update and the manifest with one", async () => {
    Object.assign(env, { VERSION: "v0.8.0" });
    const resolve = spyOn(updateService, "resolveUpdate").mockResolvedValue(null);

    expect((await get("/updates/electron/linux/x86_64/0.8.0")).status).toBe(204);

    resolve.mockResolvedValue({ version: "0.8.0", url: "https://example.com/u", signature: "c2ln" });
    const response = await get("/updates/electron/linux/x86_64/0.7.0");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ version: "0.8.0", url: "https://example.com/u", signature: "c2ln" });
  });
});
