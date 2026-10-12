import type http from "node:http";
import https from "node:https";
import net from "node:net";
import { Readable, Transform, pipeline } from "node:stream";

import { contentType } from "./file-response";
import { isPublicAddress, NonPublicAddressError, publicLookup } from "./public-address";

/** No response headers within this long: give up. */
const HEADERS_TIMEOUT_MS = 10_000;
/** A stalled transfer: no bytes for this long. */
const IDLE_TIMEOUT_MS = 15_000;
const MAX_REDIRECTS = 5;
/**
 * Samples are a few MB at most. This only stops a link to an endless stream or a huge file;
 * normal playback never gets near it, as the request ends when the user moves on.
 */
const MAX_BYTES = 64 * 1024 * 1024;
const USER_AGENT = "TunePerfect/1.0";

/** Upstream labels Chromium doesn't know, mostly Apple's for its plain AAC previews. */
const TYPE_ALIASES: Record<string, string> = {
  "audio/x-m4p": "audio/mp4",
  "audio/x-m4a": "audio/mp4",
  "audio/m4a": "audio/mp4",
  "video/x-m4v": "video/mp4",
  "audio/mp3": "audio/mpeg",
};

/** The sample URL may not be fetched: not https, or not on the public internet. */
export class BlockedSampleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BlockedSampleError";
  }
}

/** The upstream didn't answer in time, or stalled mid-transfer. */
class UpstreamTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstreamTimeoutError";
  }
}

/**
 * The sample URL as one that may be fetched, or throws `BlockedSampleError`.
 *
 * Sample URLs are user content on USDB and fetched just because someone scrolled past the
 * song, so they must not reach anything but the public internet: https on the default port,
 * no credentials, and no local names or non-public IP literals. Names are checked again when
 * the socket connects (`publicLookup`), and every redirect goes through here too.
 */
export function checkSampleUrl(raw: string): URL {
  const url = URL.parse(raw.trim());
  if (!url) throw new BlockedSampleError("not a URL");
  if (url.protocol !== "https:") throw new BlockedSampleError(`${url.protocol} is not https`);
  if (url.port !== "" && url.port !== "443") throw new BlockedSampleError(`port ${url.port}`);
  if (url.username || url.password) throw new BlockedSampleError("credentials in the URL");

  const host = url.hostname.replace(/^\[(.*)\]$/, "$1");
  if (net.isIP(host)) {
    if (!isPublicAddress(host)) throw new BlockedSampleError(`${host} is not a public address`);
  } else if (host === "localhost" || host.endsWith(".localhost") || !host.includes(".")) {
    throw new BlockedSampleError(`${host} is a local name`);
  }
  return url;
}

/**
 * The content type to answer with, or `null` if the upstream answer isn't media (an HTML
 * page, e.g. a YouTube link someone entered as the sample). Untyped answers go by the URL's
 * extension; media elements sniff the rest.
 */
export function sampleContentType(upstream: string | undefined, url: URL): string | null {
  const type = (upstream ?? "").split(";")[0]!.trim().toLowerCase();
  const aliased = TYPE_ALIASES[type] ?? type;
  if (aliased.startsWith("audio/") || aliased.startsWith("video/") || aliased === "application/ogg") return aliased;
  if (aliased === "" || aliased === "application/octet-stream" || aliased === "binary/octet-stream") {
    return contentType(url.pathname);
  }
  return null;
}

export type UpstreamRequest = (
  url: URL,
  method: string,
  headers: Record<string, string>,
) => Promise<http.IncomingMessage>;

/**
 * A request to the public internet only (see `publicLookup`). Times out if the headers take
 * too long or the transfer stalls; cancelling the response's stream closes the connection.
 */
const requestPublic: UpstreamRequest = (url, method, headers) =>
  new Promise((resolve, reject) => {
    const request = https.request(url, { method, headers, lookup: publicLookup, timeout: IDLE_TIMEOUT_MS });
    const headersTimer = setTimeout(
      () => request.destroy(new UpstreamTimeoutError(`no response within ${HEADERS_TIMEOUT_MS} ms`)),
      HEADERS_TIMEOUT_MS,
    );
    request.on("timeout", () => request.destroy(new UpstreamTimeoutError("upstream stalled")));
    request.on("response", (response) => {
      clearTimeout(headersTimer);
      resolve(response);
    });
    request.on("error", (error) => {
      clearTimeout(headersTimer);
      reject(error);
    });
    request.end();
  });

/** Follows redirects itself, so every hop passes `checkSampleUrl`. */
async function openUpstream(
  url: URL,
  method: string,
  headers: Record<string, string>,
  request: UpstreamRequest,
): Promise<http.IncomingMessage> {
  for (let redirects = 0; ; redirects++) {
    const response = await request(url, method, headers);
    const status = response.statusCode ?? 0;
    if (status < 300 || status >= 400 || status === 304) return response;

    response.destroy();
    const location = response.headers.location;
    if (!location) throw new Error(`redirect ${status} without a location`);
    if (redirects >= MAX_REDIRECTS) throw new Error("too many redirects");
    url = checkSampleUrl(new URL(location, url).href);
  }
}

/** Passes bytes through until `maxBytes`, then fails the stream. */
function byteLimit(maxBytes: number): Transform {
  let seen = 0;
  return new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      seen += chunk.length;
      if (seen > maxBytes) callback(new Error(`sample exceeds ${maxBytes} bytes`));
      else callback(null, chunk);
    },
  });
}

export interface SampleOptions {
  /** Where failures that point at a bad catalog entry go. */
  warn?: (message: string) => void;
  maxBytes?: number;
  /** Replaces the network, for tests. */
  request?: UpstreamRequest;
}

/**
 * Streams a USDB sample from its upstream URL, so the renderer can play it without the CSP
 * allowing every host uploaders link to. `Range` is passed through for seeking; only the
 * headers a media element needs come back, never cookies or redirects.
 */
export async function usdbSampleResponse(
  request: Request,
  sampleUrl: string,
  { warn = () => {}, maxBytes = MAX_BYTES, request: send = requestPublic }: SampleOptions = {},
): Promise<Response> {
  let url: URL;
  try {
    url = checkSampleUrl(sampleUrl);
  } catch (error) {
    warn(`Refusing USDB sample: ${(error as Error).message}`);
    return new Response(null, { status: 403 });
  }

  const headers: Record<string, string> = { "User-Agent": USER_AGENT, "Accept-Encoding": "identity" };
  const range = request.headers.get("range");
  if (range && /^bytes=\d*-\d*$/.test(range)) headers.Range = range;

  let upstream: http.IncomingMessage;
  try {
    upstream = await openUpstream(url, request.method, headers, send);
  } catch (error) {
    if (error instanceof BlockedSampleError || error instanceof NonPublicAddressError) {
      warn(`Refusing USDB sample from ${url.host}: ${error.message}`);
      return new Response(null, { status: 403 });
    }
    return new Response(null, { status: error instanceof UpstreamTimeoutError ? 504 : 502 });
  }

  const status = upstream.statusCode ?? 0;
  const type = sampleContentType(upstream.headers["content-type"], url);
  const encoding = upstream.headers["content-encoding"];
  const passable = status === 200 || status === 206 || status === 416;
  if (!passable || (status !== 416 && !type) || (encoding && encoding !== "identity")) {
    upstream.destroy();
    return new Response(null, { status: 502 });
  }

  const responseHeaders = new Headers();
  if (type) responseHeaders.set("Content-Type", type);
  for (const name of ["content-length", "content-range", "accept-ranges"]) {
    const value = upstream.headers[name];
    if (typeof value === "string") responseHeaders.set(name, value);
  }

  if (request.method === "HEAD" || status === 416) {
    upstream.destroy();
    return new Response(null, { status, headers: responseHeaders });
  }

  // `pipeline` destroys the upstream when the limit trips or the renderer cancels.
  const body = pipeline(upstream, byteLimit(maxBytes), () => {});
  return new Response(Readable.toWeb(body) as ReadableStream<Uint8Array>, { status, headers: responseHeaders });
}
