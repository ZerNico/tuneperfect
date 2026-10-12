import http from "node:http";
import type { AddressInfo } from "node:net";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { checkSampleUrl, sampleContentType, type UpstreamRequest, usdbSampleResponse } from "./usdb-sample";

describe("checkSampleUrl", () => {
  it.each([
    "https://audio-ssl.itunes.apple.com/itunes-assets/AudioPreview126/x.plus.aac.ep.m4a",
    "https://streamd.hitparade.ch/audio/1/2.mp3",
    "https://example.com:443/a.mp3",
    "\thttps://example.com/a.mp3 ",
    "https://8.8.8.8/a.mp3",
  ])("allows %s", (url) => {
    expect(checkSampleUrl(url).protocol).toBe("https:");
  });

  it.each([
    "http://example.com/a.mp3",
    "https://example.com:8443/a.mp3",
    "https://user:pass@example.com/a.mp3",
    "https://localhost/a.mp3",
    "https://router.localhost/a.mp3",
    "https://nas/a.mp3",
    "https://127.0.0.1/a.mp3",
    "https://192.168.178.1/a.mp3",
    "https://169.254.169.254/latest/meta-data",
    "https://[::1]/a.mp3",
    "https://[::ffff:127.0.0.1]/a.mp3",
    "file:///etc/hosts",
    "not a url",
  ])("blocks %s", (url) => {
    expect(() => checkSampleUrl(url)).toThrow();
  });
});

describe("sampleContentType", () => {
  const url = (path: string) => new URL(`https://example.com${path}`);

  it("keeps media types and renames the ones Chromium doesn't know", () => {
    expect(sampleContentType("audio/mpeg", url("/a"))).toBe("audio/mpeg");
    expect(sampleContentType("audio/x-m4p", url("/a.m4a"))).toBe("audio/mp4");
    expect(sampleContentType("video/x-m4v; charset=binary", url("/a.m4v"))).toBe("video/mp4");
    expect(sampleContentType("application/ogg", url("/a.ogg"))).toBe("application/ogg");
  });

  it("goes by the extension when the upstream doesn't say", () => {
    expect(sampleContentType("application/octet-stream", url("/a.mp3"))).toBe("audio/mpeg");
    expect(sampleContentType(undefined, url("/a.m4a"))).toBe("audio/mp4");
  });

  it("refuses pages", () => {
    expect(sampleContentType("text/html; charset=utf-8", url("/watch"))).toBeNull();
    expect(sampleContentType("application/json", url("/a.mp3"))).toBeNull();
  });
});

describe("usdbSampleResponse", () => {
  const audio = Buffer.from(Array.from({ length: 2000 }, (_, i) => i % 251));
  let upstream: http.Server;
  let port = 0;

  beforeAll(async () => {
    upstream = http.createServer((request, response) => {
      const path = new URL(request.url ?? "/", "http://upstream").pathname;
      switch (path) {
        case "/song.mp3": {
          const match = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range ?? "");
          const headers = { "Content-Type": "audio/mpeg", "Accept-Ranges": "bytes", "Set-Cookie": "tracking=1" };
          if (!match) return response.writeHead(200, headers).end(audio);
          const start = Number(match[1]);
          const end = match[2] ? Number(match[2]) : audio.length - 1;
          return response
            .writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${audio.length}` })
            .end(audio.subarray(start, end + 1));
        }
        case "/apple.m4a":
          return response.writeHead(200, { "Content-Type": "audio/x-m4p" }).end(audio);
        case "/watch":
          return response.writeHead(200, { "Content-Type": "text/html" }).end("<html>");
        case "/gzip.mp3":
          return response.writeHead(200, { "Content-Type": "audio/mpeg", "Content-Encoding": "gzip" }).end(audio);
        case "/moved":
          return response.writeHead(301, { Location: "/song.mp3" }).end();
        case "/to-private":
          return response.writeHead(302, { Location: "https://192.168.178.1/song.mp3" }).end();
        case "/to-http":
          return response.writeHead(302, { Location: "http://cdn.example.com/song.mp3" }).end();
        case "/loop":
          return response.writeHead(302, { Location: "/loop" }).end();
        default:
          return response.writeHead(404).end();
      }
    });
    await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
    port = (upstream.address() as AddressInfo).port;
  });

  afterAll(() => new Promise<void>((resolve) => upstream.close(() => resolve())));

  /** Sends what would go to `https://cdn.example.com/<path>` to the local upstream instead. */
  const toLocalUpstream: UpstreamRequest = (url, method, headers) =>
    new Promise((resolve, reject) => {
      http.request({ host: "127.0.0.1", port, path: url.pathname, method, headers }, resolve).on("error", reject).end();
    });

  const sample = (path: string, headers: Record<string, string> = {}, maxBytes?: number) => {
    const warnings: string[] = [];
    const response = usdbSampleResponse(
      new Request("media://usdb-sample/x", { headers }),
      `https://cdn.example.com${path}`,
      { request: toLocalUpstream, maxBytes, warn: (message) => warnings.push(message) },
    );
    return { response, warnings };
  };

  it("passes ranges through", async () => {
    const response = await sample("/song.mp3", { Range: "bytes=100-199" }).response;

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 100-199/2000");
    expect(response.headers.get("content-type")).toBe("audio/mpeg");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(audio.subarray(100, 200));
  });

  it("drops everything but the media headers", async () => {
    const response = await sample("/song.mp3").response;

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toBeNull();
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    expect(Buffer.from(await response.arrayBuffer())).toEqual(audio);
  });

  it("renames Apple's content type", async () => {
    expect((await sample("/apple.m4a").response).headers.get("content-type")).toBe("audio/mp4");
  });

  it("follows redirects", async () => {
    expect((await sample("/moved").response).status).toBe(200);
  });

  it("refuses redirects off the public internet or off https", async () => {
    const toPrivate = sample("/to-private");
    expect((await toPrivate.response).status).toBe(403);
    expect(toPrivate.warnings[0]).toContain("192.168.178.1");

    expect((await sample("/to-http").response).status).toBe(403);
  });

  it("gives up on redirect loops", async () => {
    expect((await sample("/loop").response).status).toBe(502);
  });

  it("refuses answers that aren't playable media", async () => {
    expect((await sample("/watch").response).status).toBe(502);
    expect((await sample("/gzip.mp3").response).status).toBe(502);
    expect((await sample("/missing.mp3").response).status).toBe(502);
  });

  it("refuses blocked URLs without contacting anyone", async () => {
    const response = await usdbSampleResponse(new Request("media://usdb-sample/x"), "https://127.0.0.1/a.mp3", {
      request: () => Promise.reject(new Error("contacted")),
    });
    expect(response.status).toBe(403);
  });

  it("ends the stream once it passes the byte limit", async () => {
    const response = await sample("/song.mp3", {}, 1000).response;
    await expect(response.arrayBuffer()).rejects.toThrow();
  });
});
