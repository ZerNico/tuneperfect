import fs from "node:fs";
import path from "node:path";

import { type BrowserWindow, type Rectangle, screen } from "electron";

/**
 * Remembers the window's size, position, maximized and fullscreen state across launches in
 * `.window-state.json`, the file Tauri's window-state plugin used (sizes and positions in
 * physical pixels, under the window label `main`). An upgrade from the Tauri version keeps
 * the window where the user left it.
 */

const FILE_NAME = ".window-state.json";
const LABEL = "main";

interface SavedState {
  width: number;
  height: number;
  x: number;
  y: number;
  maximized: boolean;
  fullscreen: boolean;
  [key: string]: unknown;
}

export interface RestoredState {
  bounds?: Rectangle;
  maximized: boolean;
  fullscreen: boolean;
}

function readAll(dir: string): Record<string, SavedState> {
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(path.join(dir, FILE_NAME), "utf8"));
    return parsed && typeof parsed === "object" ? (parsed as Record<string, SavedState>) : {};
  } catch {
    return {};
  }
}

/** Physical pixels to DIPs, using the scale of the display the point is on. */
function toDip(x: number, y: number) {
  for (const display of screen.getAllDisplays()) {
    const scale = display.scaleFactor;
    const point = { x: x / scale, y: y / scale };
    const { bounds } = display;
    if (
      point.x >= bounds.x &&
      point.x < bounds.x + bounds.width &&
      point.y >= bounds.y &&
      point.y < bounds.y + bounds.height
    ) {
      return { ...point, scale };
    }
  }
  return null;
}

/** The saved state, or `undefined` bounds when there is none or it lies off every screen. */
export function loadWindowState(dir: string): RestoredState {
  const state = readAll(dir)[LABEL];
  if (!state || !(state.width > 0) || !(state.height > 0)) return { maximized: false, fullscreen: false };

  const position = toDip(state.x, state.y);
  return {
    bounds: position
      ? {
          x: Math.round(position.x),
          y: Math.round(position.y),
          width: Math.round(state.width / position.scale),
          height: Math.round(state.height / position.scale),
        }
      : undefined,
    maximized: Boolean(state.maximized),
    fullscreen: Boolean(state.fullscreen),
  };
}

export function saveWindowState(dir: string, window: BrowserWindow) {
  const all = readAll(dir);
  const previous = all[LABEL];
  const maximized = window.isMaximized();
  const fullscreen = window.isFullScreen();

  // Like Tauri, keep the last normal size and position while maximized or fullscreen, so
  // leaving those states restores it.
  let normal = { width: previous?.width ?? 0, height: previous?.height ?? 0, x: previous?.x ?? 0, y: previous?.y ?? 0 };
  if (!maximized && !fullscreen && !window.isMinimized()) {
    const content = window.getContentBounds();
    const outer = window.getBounds();
    const scale = screen.getDisplayMatching(outer).scaleFactor;
    normal = {
      width: Math.round(content.width * scale),
      height: Math.round(content.height * scale),
      x: Math.round(outer.x * scale),
      y: Math.round(outer.y * scale),
    };
  }

  all[LABEL] = { ...previous, ...normal, maximized, fullscreen, visible: true, decorated: true };

  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, FILE_NAME), JSON.stringify(all, null, 2));
  } catch {
    // Losing the window position isn't worth failing over.
  }
}
