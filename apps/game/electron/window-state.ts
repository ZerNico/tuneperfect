import fs from "node:fs";
import path from "node:path";

import { type BrowserWindow, type Rectangle, screen } from "electron";

/** Remembers the window's size, position, maximized and fullscreen state across launches. */

const FILE_NAME = "window-state.json";

export interface WindowState {
  /** Content bounds in DIPs, from the last time the window was neither maximized nor fullscreen. */
  bounds?: Rectangle;
  maximized: boolean;
  fullscreen: boolean;
}

export function loadWindowState(dir: string): WindowState {
  try {
    const state = JSON.parse(fs.readFileSync(path.join(dir, FILE_NAME), "utf8")) as WindowState;
    // Drop a position that's no longer on any screen, e.g. after unplugging a monitor.
    const visible =
      state.bounds &&
      screen.getAllDisplays().some(({ workArea: area }) => {
        const { x, y } = state.bounds as Rectangle;
        return x >= area.x && x < area.x + area.width && y >= area.y && y < area.y + area.height;
      });
    return { ...state, bounds: visible ? state.bounds : undefined };
  } catch {
    return { maximized: false, fullscreen: false };
  }
}

export function writeWindowState(dir: string, state: WindowState) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, FILE_NAME), JSON.stringify(state, null, 2));
  } catch {
    // Losing the window position isn't worth failing over.
  }
}

export function saveWindowState(dir: string, window: BrowserWindow) {
  const maximized = window.isMaximized();
  const fullscreen = window.isFullScreen();
  // Keep the last normal bounds while maximized or fullscreen, so leaving those states
  // restores them.
  const bounds =
    maximized || fullscreen || window.isMinimized() ? loadWindowState(dir).bounds : window.getContentBounds();
  writeWindowState(dir, { bounds, maximized, fullscreen });
}
