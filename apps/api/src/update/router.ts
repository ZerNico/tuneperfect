import { os } from "@orpc/server";
import semver from "semver";
import * as v from "valibot";
import { base } from "../base";
import { env } from "../config/env";
import { updateService } from "./service";

export const updateRouter = os.prefix("/updates").router({
  getUpdate: base
    .route({
      path: "/{target}/{arch}/{currentVersion}",
      method: "GET",
      outputStructure: "detailed",
    })
    .input(
      v.object({
        target: v.string(),
        arch: v.string(),
        currentVersion: v.string(),
      }),
    )
    .handler(async ({ input }) => {
      const githubRepo = env.GITHUB_REPO;

      if (!githubRepo) {
        return {
          status: 204,
        };
      }

      const currentVersion = semver.coerce(input.currentVersion);
      const latestVersion = semver.coerce(env.VERSION);

      if (!currentVersion || !latestVersion) {
        return {
          status: 204,
        };
      }

      if (semver.gte(currentVersion, latestVersion)) {
        return {
          status: 204,
        };
      }

      const releaseName = await updateService.getReleaseName(input.target, input.arch, latestVersion.version);

      if (!releaseName) {
        return {
          status: 204,
        };
      }

      const url = `https://github.com/${githubRepo}/releases/download/v${latestVersion.version}/${releaseName}`;

      const signatureFileUrl = `${url}.sig`;
      const signature = await updateService.downloadSignatureFile(signatureFileUrl);

      if (!signature) {
        return {
          status: 204,
        };
      }

      return {
        status: 200,
        body: {
          version: env.VERSION,
          url,
          signature,
        },
      };
    }),
});
