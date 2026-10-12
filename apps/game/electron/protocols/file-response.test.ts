import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { contentType, fileResponse, parseRange } from "./file-response";

describe("parseRange", () => {
  it.each([
    ["bytes=0-", { start: 0, end: 999 }],
    ["bytes=100-199", { start: 100, end: 199 }],
    ["bytes=900-5000", { start: 900, end: 999 }],
    ["bytes=-100", { start: 900, end: 999 }],
    ["bytes=-5000", { start: 0, end: 999 }],
  ])("%s", (header, expected) => {
    expect(parseRange(header, 1000)).toEqual(expected);
  });

  it.each(["bytes=1000-", "bytes=1500-1600", "bytes=-0"])("%s is unsatisfiable", (header) => {
    expect(parseRange(header, 1000)).toBe("unsatisfiable");
  });

  it.each([null, "", "items=0-1", "bytes=-", "bytes=0-1,5-6", "bytes=200-100", "bytes=a-b"])(
    "serves the whole file for %s",
    (header) => {
      expect(parseRange(header, 1000)).toBeNull();
    },
  );
});

describe("contentType", () => {
  it("goes by the extension, case-insensitively", () => {
    expect(contentType("/songs/a/Song.MP3")).toBe("audio/mpeg");
    expect(contentType("/songs/a/cover.jpg")).toBe("image/jpeg");
    expect(contentType("/songs/a/notes")).toBe("application/octet-stream");
  });
});

describe("fileResponse", () => {
  let dir: string;
  let file: string;
  const content = Buffer.from(Array.from({ length: 10_000 }, (_, i) => i % 251));

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "tp-file-response-"));
    file = path.join(dir, "song.mp3");
    fs.writeFileSync(file, content);
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const request = (headers: Record<string, string> = {}, method = "GET") =>
    new Request("media://local/song.mp3", { method, headers });

  it("serves the whole file without a range", async () => {
    const response = await fileResponse(request(), file);

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(response.headers.get("content-length")).toBe("10000");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(content);
  });

  it("serves exactly the requested bytes", async () => {
    const response = await fileResponse(request({ Range: "bytes=100-199" }), file);

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 100-199/10000");
    expect(response.headers.get("content-length")).toBe("100");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(content.subarray(100, 200));
  });

  it("answers a range past the end with 416", async () => {
    const response = await fileResponse(request({ Range: "bytes=20000-" }), file);

    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */10000");
  });

  it("sends headers only for HEAD", async () => {
    const response = await fileResponse(request({ Range: "bytes=0-" }, "HEAD"), file);

    expect(response.status).toBe(206);
    expect(response.headers.get("content-length")).toBe("10000");
    expect(response.body).toBeNull();
  });

  it("keeps the caller's headers", async () => {
    const response = await fileResponse(request(), file, { "Access-Control-Allow-Origin": "app://tuneperfect" });

    expect(response.headers.get("access-control-allow-origin")).toBe("app://tuneperfect");
  });

  it("is 404 for a missing file or a directory", async () => {
    expect((await fileResponse(request(), path.join(dir, "missing.mp3"))).status).toBe(404);
    expect((await fileResponse(request(), dir)).status).toBe(404);
  });
});
