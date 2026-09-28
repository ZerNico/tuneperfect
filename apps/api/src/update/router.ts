import { os } from "@orpc/server";
import * as v from "valibot";

import { base } from "../base";
import { env } from "../config/env";
import { updateService } from "./service";

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
