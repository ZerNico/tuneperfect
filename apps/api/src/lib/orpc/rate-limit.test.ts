import { describe, expect, it } from "bun:test";

import { getClientIp } from "./rate-limit";

describe("getClientIp", () => {
  it("uses the right-most x-forwarded-for entry (appended by the trusted proxy)", () => {
    const headers = new Headers({ "x-forwarded-for": "1.2.3.4, 5.6.7.8, 9.10.11.12" });

    expect(getClientIp(headers)).toBe("9.10.11.12");
  });

  it("ignores spoofed client-supplied entries on the left", () => {
    // Attacker sends X-Forwarded-For: fake; proxy appends the real IP.
    const headers = new Headers({ "x-forwarded-for": "totally-fake-ip, 203.0.113.7" });

    expect(getClientIp(headers)).toBe("203.0.113.7");
  });

  it("handles a single-entry header", () => {
    const headers = new Headers({ "x-forwarded-for": "203.0.113.7" });

    expect(getClientIp(headers)).toBe("203.0.113.7");
  });

  it("trims whitespace around entries", () => {
    const headers = new Headers({ "x-forwarded-for": " 1.2.3.4 ,  203.0.113.7 " });

    expect(getClientIp(headers)).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip when x-forwarded-for is missing", () => {
    const headers = new Headers({ "x-real-ip": "198.51.100.4" });

    expect(getClientIp(headers)).toBe("198.51.100.4");
  });

  it("returns unknown when no forwarding headers are present", () => {
    expect(getClientIp(new Headers())).toBe("unknown");
    expect(getClientIp(undefined)).toBe("unknown");
  });
});
