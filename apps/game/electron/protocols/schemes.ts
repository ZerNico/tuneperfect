import { protocol } from "electron";

import { MEDIA_SCHEME } from "../../src/lib/native/media";

/** The bundled renderer (`renderer.ts`). Development loads it from the Vite server instead. */
export const APP_SCHEME = "app";
export const APP_ORIGIN = `${APP_SCHEME}://tuneperfect`;

/** Registered as `standard` below, so their URLs have a host and a real origin. */
const STANDARD_SCHEMES = new Set([`${APP_SCHEME}:`, `${MEDIA_SCHEME}:`]);

/**
 * The origin of `url` as Chromium sees it, or `null` if it has none (`data:`, `about:blank`).
 *
 * Use this instead of `URL#origin` in the main process: Node's `URL` only knows the web's
 * own schemes and gives every other one the opaque origin `"null"`, so `app://` pages would
 * compare equal to any opaque page, and a CORS header built from it would match nothing.
 */
export function originOf(url: string): string | null {
  const parsed = URL.parse(url);
  if (!parsed) return null;
  if (parsed.origin !== "null") return parsed.origin;
  return STANDARD_SCHEMES.has(parsed.protocol) && parsed.host ? `${parsed.protocol}//${parsed.host}` : null;
}

/**
 * Gives the app's schemes their privileges. Electron only accepts this once, before the
 * `ready` event, so every scheme is declared here.
 */
export function registerSchemes() {
  protocol.registerSchemesAsPrivileged([
    { scheme: APP_SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } },
    {
      scheme: MEDIA_SCHEME,
      privileges: {
        // A real origin: Chromium only accepts a media element's later range responses from
        // the origin that served the first one, and an opaque origin never matches.
        standard: true,
        // Loadable from the secure app page without counting as mixed content.
        secure: true,
        supportFetchAPI: true,
        // Media elements stream the response instead of waiting for all of it.
        stream: true,
        // `SongPlayer` loads media with `crossorigin` to route it through Web Audio.
        corsEnabled: true,
      },
    },
  ]);
}
