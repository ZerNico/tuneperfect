/** Values the preload exposes synchronously; see `electron/preload.ts`. */
interface DesktopGlobals {
  platform: string;
  version: string;
}

declare global {
  interface Window {
    tuneperfect: DesktopGlobals;
  }
}

export const desktop: DesktopGlobals = window.tuneperfect;
