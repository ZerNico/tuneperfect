import { os } from "@orpc/server";
import * as v from "valibot";

import { base } from "../base";
import { env } from "../config/env";
import { MIN_GAME_VERSION, updateService } from "./service";

const updateInput = v.object({
  target: v.string(),
  arch: v.string(),
  currentVersion: v.string(),
});

async function respond(input: v.InferOutput<typeof updateInput>, releaseVersion: string | undefined) {
  if (!releaseVersion) return { status: 204 };
  const update = await updateService.resolveUpdate({ githubRepo: env.GITHUB_REPO, releaseVersion, ...input });
  return update ? { status: 200, body: update } : { status: 204 };
}

export const updateRouter = os.prefix("/updates").router({
  /**
   * Polled by installed Tauri versions of the game. Serves only `TAURI_VERSION` (the last
   * Tauri release, eventually the one that migrates to Electron) and nothing when it's
   * unset, so these installs never update straight into an Electron build.
   */
  getUpdate: base
    .route({
      path: "/{target}/{arch}/{currentVersion}",
      method: "GET",
      outputStructure: "detailed",
    })
    .input(updateInput)
    .handler(({ input }) => respond(input, env.TAURI_VERSION)),

  /**
   * Asked by the last Tauri release before it moves the install to Electron. Controlled
   * by `TAURI_MIGRATION_ENABLED`, so the rollout can go per platform and be switched off.
   */
  getTauriMigration: base
    .route({ path: "/tauri-migration/{target}", method: "GET" })
    .input(v.object({ target: v.string() }))
    .output(v.object({ enabled: v.boolean() }))
    .handler(({ input }) => {
      const enabled = env.TAURI_MIGRATION_ENABLED;
      return { enabled: enabled.includes("all") || enabled.includes(input.target.toLowerCase()) };
    }),

  /**
   * Asked by the Electron app at startup and when going online fails. Plain REST on purpose:
   * it must keep answering games that speak an older RPC protocol, since raising the minimum
   * is how they're told to update. Keep the path and the response shape stable.
   */
  getGameSupport: base
    .route({ path: "/game-support/{currentVersion}", method: "GET" })
    .input(v.object({ currentVersion: v.string() }))
    .output(v.object({ supported: v.boolean() }))
    .handler(({ input }) => ({
      supported: updateService.isGameSupported({
        currentVersion: input.currentVersion,
        minVersion: MIN_GAME_VERSION,
        releaseVersion: env.VERSION,
      }),
    })),

  /** Polled by the Electron app. */
  getElectronUpdate: base
    .route({
      path: "/electron/{target}/{arch}/{currentVersion}",
      method: "GET",
      outputStructure: "detailed",
    })
    .input(updateInput)
    .handler(({ input }) => respond(input, env.VERSION)),
});
