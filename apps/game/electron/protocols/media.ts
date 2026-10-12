import { protocol } from "electron";

import { MEDIA_SCHEME, SONG_FILES_HOST, USDB_SAMPLE_HOST } from "../../src/lib/native/media";
import { native } from "../native";
import { fileResponse } from "./file-response";
import { usdbSampleResponse } from "./usdb-sample";

/** What a `media://` URL asks for (see `src/lib/native/media.ts` for the URL shapes). */
export type MediaTarget = { kind: "song-file"; path: string } | { kind: "usdb-sample"; url: string };

export function mediaTarget(url: string): MediaTarget | null {
  const parsed = URL.parse(url);
  // Node's URL gives schemes it doesn't know an opaque origin, so compare the parts.
  if (parsed?.protocol !== `${MEDIA_SCHEME}:`) return null;

  let value: string;
  try {
    value = decodeURIComponent(parsed.pathname.slice(1));
  } catch {
    return null;
  }
  if (!value) return null;

  if (parsed.host === SONG_FILES_HOST) return { kind: "song-file", path: value };
  if (parsed.host === USDB_SAMPLE_HOST) return { kind: "usdb-sample", url: value };
  return null;
}

/**
 * Serves `media://`: files from the granted song folders, and USDB samples streamed from
 * their upstream hosts.
 *
 * The scheme only exists inside the app's session: unlike a loopback HTTP server, other
 * browsers, websites and local processes can't reach it at all. Every request is still
 * checked, so the renderer can't read outside the granted folders or make the app fetch
 * anything but public media either.
 */
export function handleMediaProtocol(appOrigin: string, warn: (message: string) => void) {
  protocol.handle(MEDIA_SCHEME, async (request) => {
    // Media loaded with `crossorigin` (see `schemes.ts`) needs CORS, but only ever from the app.
    const cors = { "Access-Control-Allow-Origin": appOrigin };

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response(null, { status: 405, headers: { ...cors, Allow: "GET, HEAD" } });
    }

    const target = mediaTarget(request.url);
    switch (target?.kind) {
      case "song-file":
        if (!native.isPathAllowed(target.path)) return new Response(null, { status: 403, headers: cors });
        return fileResponse(request, target.path, cors);
      case "usdb-sample": {
        const response = await usdbSampleResponse(request, target.url, { warn });
        response.headers.set("Access-Control-Allow-Origin", appOrigin);
        return response;
      }
      default:
        return new Response(null, { status: 404, headers: cors });
    }
  });
}
