import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { app, screen } from "electron";

import type { Logger } from "./logger";
import { type WindowState, writeWindowState } from "./window-state";

/**
 * One-time move of the Tauri version's data into this app's data directory: settings,
 * players, scores and the other stores, plus the window position. Remove this module once
 * no Tauri installs are left.
 */

// The Tauri builds kept their data in directories named after their identifier.
const identifier = app.isPackaged ? "org.tuneperfect.game" : "localhost.tuneperfect.game";
const home = os.homedir();

/** Tauri's `app_data_dir` (stores) and `app_config_dir` (window state). */
function tauriDirectories(): { data: string; config: string } {
  if (process.platform === "linux") {
    return {
      data: path.join(process.env.XDG_DATA_HOME || path.join(home, ".local", "share"), identifier),
      config: path.join(process.env.XDG_CONFIG_HOME || path.join(home, ".config"), identifier),
    };
  }
  const dir = path.join(app.getPath("appData"), identifier);
  return { data: dir, config: dir };
}

/** Tauri saved the window in physical pixels; convert with the scale of the display it was on. */
function convertWindowState(file: string): WindowState | null {
  try {
    const all = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, Record<string, unknown>>;
    const main = all.main;
    if (!main) return null;
    const { x, y, width, height } = main;
    if (typeof x !== "number" || typeof y !== "number" || typeof width !== "number" || typeof height !== "number") {
      return null;
    }

    // Find the display whose area, in physical pixels, contains the saved position.
    for (const display of screen.getAllDisplays()) {
      const scale = display.scaleFactor;
      const { bounds } = display;
      const inside =
        x >= bounds.x * scale &&
        x < (bounds.x + bounds.width) * scale &&
        y >= bounds.y * scale &&
        y < (bounds.y + bounds.height) * scale;
      if (inside) {
        return {
          bounds: {
            x: Math.round(x / scale),
            y: Math.round(y / scale),
            width: Math.round(width / scale),
            height: Math.round(height / scale),
          },
          maximized: Boolean(main.maximized),
          fullscreen: Boolean(main.fullscreen),
        };
      }
    }
    return { maximized: Boolean(main.maximized), fullscreen: Boolean(main.fullscreen) };
  } catch {
    return null;
  }
}

/**
 * Moves the Tauri data into `target` if `target` doesn't have settings yet. The old
 * directories are only deleted once everything was copied.
 */
export function migrateFromTauri(target: string, logger: Logger) {
  const legacy = tauriDirectories();
  if (fs.existsSync(path.join(target, "settings.json")) || !fs.existsSync(path.join(legacy.data, "settings.json"))) {
    return;
  }

  try {
    fs.mkdirSync(target, { recursive: true });
    const windowState = convertWindowState(path.join(legacy.config, ".window-state.json"));
    if (windowState) writeWindowState(target, windowState);

    // The stores (settings.json, local.json, …, including backups). Dotfiles are Tauri's
    // own bookkeeping; `.window-state.json` was converted above. settings.json goes last:
    // its presence marks the move as done, so an interrupted move is retried.
    const stores = fs
      .readdirSync(legacy.data)
      .filter((file) => file.endsWith(".json") && !file.startsWith("."))
      .toSorted((a, b) => Number(a === "settings.json") - Number(b === "settings.json"));
    for (const file of stores) {
      fs.copyFileSync(path.join(legacy.data, file), path.join(target, file));
    }
  } catch (error) {
    logger.write("ERROR", "tuneperfect", `Moving the Tauri data failed, keeping it in place: ${String(error)}`);
    return;
  }

  for (const dir of new Set([legacy.data, legacy.config])) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
  logger.write("INFO", "tuneperfect", `Moved the data of the Tauri version from ${legacy.data} to ${target}`);
}
