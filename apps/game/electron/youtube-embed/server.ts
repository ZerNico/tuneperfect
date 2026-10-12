import http from "node:http";

import PLAYER_HTML from "./player.html?raw";

const PLAYER_PATH = "/embed/youtube";

/** Tried in order. A stable port keeps the page's origin, and whatever YouTube keys on it, the same across launches. */
const FIRST_PORT = 24000;
const PORT_ATTEMPTS = 100;

export interface YoutubeEmbedServer {
  /** The player page. The renderer adds `?parentOrigin=` (see `player.html`). */
  playerUrl: string;
  close(): Promise<void>;
}

/**
 * Serves the YouTube player page on loopback HTTP, the one thing the app can't serve over its
 * own schemes: YouTube only plays embeds whose parent page has an http(s) origin to send as
 * `Referer` (see `player.html`).
 *
 * The page is public and static, so there is nothing here to protect. The Host check still
 * keeps DNS-rebinding pages from reaching the server under their own name.
 */
export async function startYoutubeEmbedServer(
  frameAncestors: string[],
  firstPort = FIRST_PORT,
): Promise<YoutubeEmbedServer> {
  const ipv6 = await loopbackIpv6Available();

  for (let port = firstPort; port < firstPort + PORT_ATTEMPTS; port++) {
    const handler = createHandler(port, frameAncestors);
    const servers = await listenOnLoopback(port, ipv6, handler);
    if (servers) {
      return {
        playerUrl: `http://localhost:${port}${PLAYER_PATH}`,
        close: () => Promise.all(servers.map(close)).then(() => {}),
      };
    }
  }

  throw new Error(`No free port for the YouTube embed server in ${firstPort}-${firstPort + PORT_ATTEMPTS - 1}`);
}

function createHandler(port: number, frameAncestors: string[]): http.RequestListener {
  const hosts = new Set([`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`]);
  const playerHeaders = {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Content-Security-Policy": `frame-ancestors ${frameAncestors.join(" ")}`,
    // What YouTube asks embedders to send; the origin is all it needs.
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Content-Type-Options": "nosniff",
  };

  return (request, response) => {
    if (!hosts.has(request.headers.host ?? "")) return end(response, 403);
    if (request.method !== "GET" && request.method !== "HEAD") return end(response, 405, { Allow: "GET, HEAD" });

    const { pathname } = new URL(request.url ?? "/", "http://localhost");
    if (pathname !== PLAYER_PATH) return end(response, 404);

    response.writeHead(200, playerHeaders);
    response.end(request.method === "HEAD" ? undefined : PLAYER_HTML);
  };
}

function end(response: http.ServerResponse, status: number, headers: http.OutgoingHttpHeaders = {}) {
  response.writeHead(status, { "Content-Type": "text/plain", ...headers });
  response.end(http.STATUS_CODES[status]);
}

/**
 * One server per loopback address `localhost` can resolve to, all on `port`, or `null` if
 * the port is taken on any of them. Serving on IPv4 only while advertising `localhost`
 * fails wherever `localhost` resolves to `::1` first.
 */
async function listenOnLoopback(
  port: number,
  ipv6: boolean,
  handler: http.RequestListener,
): Promise<http.Server[] | null> {
  const servers: http.Server[] = [];
  for (const host of ipv6 ? ["127.0.0.1", "::1"] : ["127.0.0.1"]) {
    const server = http.createServer(handler);
    if (!(await listen(server, port, host))) {
      await Promise.all(servers.map(close));
      return null;
    }
    servers.push(server);
  }
  return servers;
}

function listen(server: http.Server, port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    server.once("error", () => resolve(false));
    server.listen(port, host, () => resolve(true));
  });
}

async function loopbackIpv6Available(): Promise<boolean> {
  const probe = http.createServer();
  const available = await listen(probe, 0, "::1");
  if (available) await close(probe);
  return available;
}

function close(server: http.Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}
