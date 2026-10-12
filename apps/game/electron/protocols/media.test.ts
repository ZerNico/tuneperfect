import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const handlers = vi.hoisted(() => new Map<string, (request: Request) => Response | Promise<Response>>());
const allowed = vi.hoisted(() => ({ root: "" }));

vi.mock("electron", () => ({
  protocol: { handle: (scheme: string, handler: (request: Request) => Response) => handlers.set(scheme, handler) },
}));
vi.mock("../native", () => ({
  native: { isPathAllowed: (file: string) => file.startsWith(allowed.root + path.sep) },
}));

const { MEDIA_BASE_URL, handleMediaProtocol, mediaPath } = await import("./media");

const urlFor = (file: string) => `${MEDIA_BASE_URL}/${encodeURIComponent(file)}`;

describe("mediaPath", () => {
  it("decodes the path the addon encoded", () => {
    expect(mediaPath(urlFor("/Music/Artist - Title/song (live).mp3"))).toBe("/Music/Artist - Title/song (live).mp3");
    expect(mediaPath(urlFor("C:\\Songs\\Ärzte\\song.mp3"))).toBe("C:\\Songs\\Ärzte\\song.mp3");
  });

  it("rejects anything else", () => {
    expect(mediaPath("media://other/%2Fsong.mp3")).toBeNull();
    expect(mediaPath("app://tuneperfect/%2Fsong.mp3")).toBeNull();
    expect(mediaPath(`${MEDIA_BASE_URL}/`)).toBeNull();
    expect(mediaPath(`${MEDIA_BASE_URL}/%E0%A4%A`)).toBeNull();
  });
});

describe("media protocol", () => {
  let dir: string;
  let song: string;
  let outside: string;

  beforeAll(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), "tp-media-"));
    fs.mkdirSync(path.join(dir, "songs"));
    song = path.join(dir, "songs", "song.mp3");
    outside = path.join(dir, "secret.txt");
    fs.writeFileSync(song, "song");
    fs.writeFileSync(outside, "secret");
    allowed.root = path.join(dir, "songs");
    handleMediaProtocol("app://tuneperfect");
  });

  afterAll(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  const handle = (url: string, init?: RequestInit) => Promise.resolve(handlers.get("media")!(new Request(url, init)));

  it("serves files in granted folders, with CORS for the app", async () => {
    const response = await handle(urlFor(song), { headers: { Range: "bytes=1-" } });

    expect(response.status).toBe(206);
    expect(await response.text()).toBe("ong");
    expect(response.headers.get("access-control-allow-origin")).toBe("app://tuneperfect");
  });

  it("refuses files outside the granted folders", async () => {
    const response = await handle(urlFor(outside));

    expect(response.status).toBe(403);
    expect(response.headers.get("access-control-allow-origin")).toBe("app://tuneperfect");
  });

  it("only reads", async () => {
    expect((await handle(urlFor(song), { method: "POST" })).status).toBe(405);
  });
});
