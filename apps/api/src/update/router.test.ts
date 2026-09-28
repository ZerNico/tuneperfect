import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { call } from "@orpc/server";

import { env } from "../config/env";
import { updateRouter } from "./router";
import { updateService } from "./service";

const context = { cookies: new Bun.CookieMap(), headers: new Headers(), resHeaders: new Headers() };
const input = { target: "linux", arch: "x86_64", currentVersion: "0.3.0" };
const original = { VERSION: env.VERSION, TAURI_VERSION: env.TAURI_VERSION, GITHUB_REPO: env.GITHUB_REPO };

function stubRelease() {
  return spyOn(updateService, "resolveUpdate").mockImplementation(async ({ releaseVersion }) => ({
    version: releaseVersion.replace(/^v/, ""),
    url: `https://example.com/${releaseVersion}`,
    signature: "c2ln",
  }));
}

afterEach(() => {
  mock.restore();
  Object.assign(env, original);
});

describe("getUpdate (installed Tauri versions)", () => {
  it("offers nothing while TAURI_VERSION is unset, even when a newer release exists", async () => {
    Object.assign(env, { VERSION: "v0.5.0", TAURI_VERSION: undefined });
    const resolve = stubRelease();

    expect(await call(updateRouter.getUpdate, input, { context })).toEqual({ status: 204 });
    expect(resolve).not.toHaveBeenCalled();
  });

  it("offers TAURI_VERSION, never the latest release", async () => {
    Object.assign(env, { VERSION: "v0.5.0", TAURI_VERSION: "v0.3.1" });
    stubRelease();

    const result = await call(updateRouter.getUpdate, input, { context });
    expect(result).toMatchObject({ status: 200, body: { version: "0.3.1" } });
  });
});

describe("getElectronUpdate", () => {
  it("offers the latest release regardless of TAURI_VERSION", async () => {
    Object.assign(env, { VERSION: "v0.5.0", TAURI_VERSION: "v0.3.1" });
    stubRelease();

    const result = await call(updateRouter.getElectronUpdate, input, { context });
    expect(result).toMatchObject({ status: 200, body: { version: "0.5.0" } });
  });
});
