import { native } from "~/lib/native/client";
import type { UpdateInstallEvent } from "~/lib/native/contract";

export interface Update {
  version: string;
  /** Downloads, verifies and installs the update; the app restarts into it when done. */
  downloadAndInstall(onProgress?: (event: UpdateInstallEvent) => void): Promise<void>;
}

export async function check(): Promise<Update | null> {
  const update = await native.updates.check();
  if (!update) return null;

  return {
    version: update.version,
    async downloadAndInstall(onProgress) {
      for await (const event of await native.updates.install()) {
        onProgress?.(event);
      }
    },
  };
}
