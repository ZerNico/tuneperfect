import os from "node:os";
import path from "node:path";

import { app } from "electron";

/**
 * The directories the Tauri version used (its `app_data_dir`, `app_config_dir` and
 * `app_log_dir`), so existing settings, players, scores and window state are picked up
 * as-is and logs keep landing where they did.
 */

// Release builds were bundled under the production identifier, local builds under the
// development one.
function identifier(): string {
  return app.isPackaged ? "org.tuneperfect.game" : "localhost.tuneperfect.game";
}

const home = os.homedir();

/** Settings, players, scores and other stores. Override with `TUNEPERFECT_STORE_DIR`, e.g. to use a copy. */
export function storeDir(): string {
  const override = process.env.TUNEPERFECT_STORE_DIR;
  if (override) return override;

  if (process.platform === "linux") {
    return path.join(process.env.XDG_DATA_HOME || path.join(home, ".local", "share"), identifier());
  }
  return path.join(app.getPath("appData"), identifier());
}

/** Window size and position. Same as the store directory except on Linux. */
export function configDir(): string {
  const override = process.env.TUNEPERFECT_STORE_DIR;
  if (override) return override;

  if (process.platform === "linux") {
    return path.join(process.env.XDG_CONFIG_HOME || path.join(home, ".config"), identifier());
  }
  return storeDir();
}

export function logDir(): string {
  switch (process.platform) {
    case "darwin":
      return path.join(home, "Library", "Logs", identifier());
    case "win32":
      return path.join(process.env.LOCALAPPDATA || path.join(home, "AppData", "Local"), identifier(), "logs");
    default:
      return path.join(process.env.XDG_DATA_HOME || path.join(home, ".local", "share"), identifier(), "logs");
  }
}
