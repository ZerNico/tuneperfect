import http from "node:http";

import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { startYoutubeEmbedServer, type YoutubeEmbedServer } from "./server";

describe("YouTube embed server", () => {
  let server: YoutubeEmbedServer;
  let port = 0;

  beforeAll(async () => {
    // Clear of the production range, so a running game doesn't get in the way.
    server = await startYoutubeEmbedServer(["app://tuneperfect"], 45000 + Math.floor(Math.random() * 5000));
    port = Number(new URL(server.playerUrl).port);
  });

  afterAll(() => server.close());

  /** Raw requests, since `fetch` won't let the Host header be set. */
  function get(path: string, { host = `localhost:${port}`, method = "GET" } = {}) {
    return new Promise<{ status: number; headers: http.IncomingHttpHeaders; body: string }>((resolve, reject) => {
      const request = http.request({ host: "127.0.0.1", port, path, method, headers: { Host: host } }, (response) => {
        let body = "";
        response.on("data", (chunk) => (body += chunk));
        response.on("end", () => resolve({ status: response.statusCode ?? 0, headers: response.headers, body }));
      });
      request.on("error", reject);
      request.end();
    });
  }

  it("advertises the player page on localhost", () => {
    expect(server.playerUrl).toBe(`http://localhost:${port}/embed/youtube`);
  });

  it("serves the player page, frameable by the app only", async () => {
    const response = await get("/embed/youtube?parentOrigin=app%3A%2F%2Ftuneperfect");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toBe("text/html; charset=utf-8");
    expect(response.headers["content-security-policy"]).toBe("frame-ancestors app://tuneperfect");
    expect(response.body).toContain("tp-yt");
  });

  it.each(["127.0.0.1", "[::1]"])("accepts %s as the host", async (name) => {
    expect((await get("/embed/youtube", { host: `${name}:${port}` })).status).toBe(200);
  });

  it.each(["evil.example", `evil.example:${port}`, "localhost:1"])("refuses the rebinding host %s", async (host) => {
    expect((await get("/embed/youtube", { host })).status).toBe(403);
  });

  it("serves nothing else", async () => {
    expect((await get("/")).status).toBe(404);
    expect((await get("/media/%2Fetc%2Fpasswd")).status).toBe(404);
    expect((await get("/embed/youtube", { method: "POST" })).status).toBe(405);
  });
});
