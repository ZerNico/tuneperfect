/** Values the preload provides synchronously (see `electron/preload.ts`). */
interface DesktopGlobals {
  platform: string;
  version: string;
}

declare global {
  interface Window {
    tuneperfect: DesktopGlobals;
  }
}

const globals: DesktopGlobals = window.tuneperfect;

export type Platform = "macos" | "windows" | "linux";

export const platform: Platform =
  globals.platform === "darwin" ? "macos" : globals.platform === "win32" ? "windows" : "linux";

export const appVersion: string = globals.version;
