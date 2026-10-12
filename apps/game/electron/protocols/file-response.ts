import fs from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";

/** By extension. Media elements sniff anyway, but images and `fetch` callers rely on it. */
const CONTENT_TYPES: Record<string, string> = {
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".oga": "audio/ogg",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".wav": "audio/wav",
  ".weba": "audio/webm",
  ".avi": "video/x-msvideo",
  ".m4v": "video/mp4",
  ".mkv": "video/x-matroska",
  ".mov": "video/quicktime",
  ".mp4": "video/mp4",
  ".ogv": "video/ogg",
  ".webm": "video/webm",
  ".avif": "image/avif",
  ".bmp": "image/bmp",
  ".gif": "image/gif",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".txt": "text/plain",
};

export function contentType(filePath: string): string {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

/**
 * Bytes per read. Every chunk passes through the main process's JavaScript; Node's 64 KiB
 * default made full reads ~40% slower than the old Rust server, while 256 KiB matches it.
 * Playback itself only needs a few chunks a second.
 */
const CHUNK_SIZE = 256 * 1024;

export type ByteRange = { start: number; end: number };

/**
 * A single `Range: bytes=…` header against a file of `size` bytes: the inclusive range to
 * send, `"unsatisfiable"` for a range past the end, or `null` to send the whole file (no
 * header, a malformed one, or several ranges, which media elements never ask for).
 */
export function parseRange(header: string | null, size: number): ByteRange | "unsatisfiable" | null {
  const match = header ? /^bytes=(\d*)-(\d*)$/.exec(header.trim()) : null;
  if (!match) return null;
  const [, first = "", last = ""] = match;

  if (first === "") {
    // Suffix range: the last `last` bytes.
    if (last === "") return null;
    const length = Number(last);
    if (length === 0) return "unsatisfiable";
    return { start: Math.max(0, size - length), end: size - 1 };
  }

  const start = Number(first);
  if (start >= size) return "unsatisfiable";
  const end = last === "" ? size - 1 : Math.min(Number(last), size - 1);
  return end < start ? null : { start, end };
}

/**
 * Answers `request` with the file at `filePath`, honouring `Range`.
 *
 * Protocol handlers have to do this themselves: a plain `net.fetch` of the `file://` URL
 * ignores ranges, so media elements can't seek (electron/electron#38749). Chromium asks
 * for `bytes=0-` up front and then jumps around with open-ended ranges, cancelling the
 * previous request each time; cancelling the web stream closes the file.
 */
export async function fileResponse(request: Request, filePath: string, headers: HeadersInit = {}): Promise<Response> {
  const stat = await fs.promises.stat(filePath).catch(() => null);
  if (!stat?.isFile()) return new Response(null, { status: 404, headers });

  const responseHeaders = new Headers(headers);
  responseHeaders.set("Content-Type", contentType(filePath));
  responseHeaders.set("Accept-Ranges", "bytes");

  const range = parseRange(request.headers.get("range"), stat.size);
  if (range === "unsatisfiable") {
    responseHeaders.set("Content-Range", `bytes */${stat.size}`);
    return new Response(null, { status: 416, headers: responseHeaders });
  }

  const { start, end } = range ?? { start: 0, end: stat.size - 1 };
  responseHeaders.set("Content-Length", String(Math.max(0, end - start + 1)));
  if (range) responseHeaders.set("Content-Range", `bytes ${start}-${end}/${stat.size}`);

  const status = range ? 206 : 200;
  // An empty file has no byte to start a read stream at.
  if (request.method === "HEAD" || stat.size === 0) {
    return new Response(null, { status, headers: responseHeaders });
  }

  const body = Readable.toWeb(
    fs.createReadStream(filePath, { start, end, highWaterMark: CHUNK_SIZE }),
  ) as ReadableStream<Uint8Array>;
  return new Response(body, { status, headers: responseHeaders });
}
