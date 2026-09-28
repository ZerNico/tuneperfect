import os from "node:os";
import path from "node:path";

import { app } from "electron";

/**
 * Where the persistent stores live. This is the directory the Tauri version used
 * (its `appDataDir`), so existing settings, players and scores are picked up as-is.
 * Override with `TUNEPERFECT_STORE_DIR`, e.g. to experiment on a copy.
 */
export function storeDir(): string {
  const override = process.env.TUNEPERFECT_STORE_DIR;
  if (override) return override;

  // Release builds were bundled under the production identifier, local builds under the
  // development one.
  const identifier = app.isPackaged ? "org.tuneperfect.game" : "localhost.tuneperfect.game";

  if (process.platform === "linux") {
    const dataHome = process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share");
    return path.join(dataHome, identifier);
  }

  return path.join(app.getPath("appData"), identifier);
}
