import { protocol } from "electron";

import { native } from "../native";
import { fileResponse } from "./file-response";
import { MEDIA_SCHEME } from "./schemes";

/**
 * Song media URLs are `media://local/<percent-encoded absolute path>`. The addon builds
 * them while parsing songs, below this base.
 */
const MEDIA_HOST = "local";
export const MEDIA_BASE_URL = `${MEDIA_SCHEME}://${MEDIA_HOST}`;

/** The file a `media://` URL points to, or `null` if it doesn't name one. */
export function mediaPath(url: string): string | null {
  const parsed = URL.parse(url);
  // Node's URL gives schemes it doesn't know an opaque origin, so compare the parts.
  if (parsed?.protocol !== `${MEDIA_SCHEME}:` || parsed.host !== MEDIA_HOST) return null;
  try {
    return decodeURIComponent(parsed.pathname.slice(1)) || null;
  } catch {
    return null;
  }
}

/**
 * Serves files from the granted song folders on `media://`.
 *
 * The scheme only exists inside the app's session: unlike a loopback HTTP server, other
 * browsers, websites and local processes can't reach it at all. The allowlist still checks
 * every request, so the renderer can't read outside the granted folders either.
 */
export function handleMediaProtocol(appOrigin: string) {
  protocol.handle(MEDIA_SCHEME, (request) => {
    // Media loaded with `crossorigin` (see `schemes.ts`) needs CORS, but only ever from the app.
    const headers = { "Access-Control-Allow-Origin": appOrigin };

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { ...headers, Allow: "GET, HEAD" } });
    }

    const filePath = mediaPath(request.url);
    if (!filePath || !native.isPathAllowed(filePath)) {
      return new Response(null, { status: 403, headers });
    }

    return fileResponse(request, filePath, headers);
  });
}
