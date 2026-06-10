import { describe, expect, it } from "bun:test";

import { executeWithConstantTime, isValidRedirectUrl } from "./security";

const APP_URL = "https://app.test.localhost";

describe("isValidRedirectUrl", () => {
  it("accepts a url with the same host and protocol", () => {
    expect(isValidRedirectUrl(`${APP_URL}/lobby`, [APP_URL])).toBe(true);
    expect(isValidRedirectUrl(APP_URL, [APP_URL])).toBe(true);
  });

  it("rejects other hosts", () => {
    expect(isValidRedirectUrl("https://evil.com", [APP_URL])).toBe(false);
    expect(isValidRedirectUrl("https://app.test.localhost.evil.com", [APP_URL])).toBe(false);
  });

  it("rejects subdomains of the allowed host", () => {
    expect(isValidRedirectUrl("https://sub.app.test.localhost", [APP_URL])).toBe(false);
  });

  it("rejects protocol downgrades", () => {
    expect(isValidRedirectUrl("http://app.test.localhost", [APP_URL])).toBe(false);
  });

  it("rejects protocol-relative urls", () => {
    expect(isValidRedirectUrl("//evil.com", [APP_URL])).toBe(false);
  });

  it("rejects javascript: urls", () => {
    expect(isValidRedirectUrl("javascript:alert(1)", [APP_URL])).toBe(false);
  });

  it("rejects relative paths (no host)", () => {
    expect(isValidRedirectUrl("/lobby", [APP_URL])).toBe(false);
  });

  it("rejects undefined and empty values", () => {
    expect(isValidRedirectUrl(undefined, [APP_URL])).toBe(false);
    expect(isValidRedirectUrl("", [APP_URL])).toBe(false);
  });

  it("rejects everything when the allowlist is empty", () => {
    expect(isValidRedirectUrl(APP_URL, [])).toBe(false);
    expect(isValidRedirectUrl(APP_URL)).toBe(false);
  });

  it("accepts a url matching any of multiple allowed domains", () => {
    expect(isValidRedirectUrl("https://other.localhost/x", [APP_URL, "https://other.localhost"])).toBe(true);
  });
});

describe("executeWithConstantTime", () => {
  it("takes at least the target time on success", async () => {
    const start = performance.now();
    const result = await executeWithConstantTime(async () => "ok", 50);
    const elapsed = performance.now() - start;

    expect(result).toBe("ok");
    expect(elapsed).toBeGreaterThanOrEqual(45);
  });

  it("takes at least the target time when the function throws", async () => {
    const start = performance.now();

    await expect(
      executeWithConstantTime(async () => {
        throw new Error("boom");
      }, 50),
    ).rejects.toThrow("boom");

    const elapsed = performance.now() - start;
    expect(elapsed).toBeGreaterThanOrEqual(45);
  });

  it("does not add extra delay when the function is slower than the target", async () => {
    const start = performance.now();
    await executeWithConstantTime(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    }, 10);
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(120);
  });
});
