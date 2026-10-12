import { describe, expect, it, vi } from "vitest";

vi.mock("electron", () => ({ protocol: {} }));

const { originOf } = await import("./schemes");

describe("originOf", () => {
  it("gives the app's standard schemes a real origin", () => {
    expect(originOf("app://tuneperfect/sing?x=1")).toBe("app://tuneperfect");
    expect(originOf("app://tuneperfect")).toBe("app://tuneperfect");
    expect(originOf("media://local/%2Fsong.mp3")).toBe("media://local");
  });

  it("matches URL#origin for web schemes", () => {
    expect(originOf("http://localhost:1420/sing")).toBe("http://localhost:1420");
    expect(originOf("https://tuneperfect.org")).toBe("https://tuneperfect.org");
  });

  it("is null for opaque origins, so they never match the app", () => {
    expect(originOf("data:text/html,<p>")).toBeNull();
    expect(originOf("about:blank")).toBeNull();
    expect(originOf("other://tuneperfect/")).toBeNull();
    expect(originOf("not a url")).toBeNull();
  });
});
