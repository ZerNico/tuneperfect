import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

import { net, protocol } from "electron";

import { APP_SCHEME } from "./schemes";

/**
 * Serves the built frontend from `rendererDir` on `app://`, falling back to `index.html`
 * for client-side routes. Every response carries the app's CSP.
 */
export function handleRendererProtocol(rendererDir: string, contentSecurityPolicy: string) {
  protocol.handle(APP_SCHEME, async (request) => {
    const { pathname } = new URL(request.url);
    const requested = path.normalize(path.join(rendererDir, decodeURIComponent(pathname)));
    const insideRenderer = requested.startsWith(rendererDir + path.sep);
    const file =
      insideRenderer && fs.statSync(requested, { throwIfNoEntry: false })?.isFile()
        ? requested
        : path.join(rendererDir, "index.html");

    const response = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(response.headers);
    headers.set("Content-Security-Policy", contentSecurityPolicy);
    return new Response(response.body, { status: response.status, headers });
  });
}
