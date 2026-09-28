import { describe, expect, it } from "vitest";

import { verifyMinisign } from "./minisign";

// Generated with `tauri signer generate` / `tauri signer sign` (password-less test keys).
const PUBLIC_KEY =
  "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDg2RkVBOTREOEQ2QTQ5RTMKUldUalNXcU5UYW4raGtWeHowZytQM2dBTW9WVjJlOUhtSVNrRzU5UVo5RVJ6S2FXUVNOTGwrenYK";
const OTHER_PUBLIC_KEY =
  "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDc0ODM2Mjc2MzNBQTRCMTUKUldRVlM2b3pkbUtEZEc0Z3UwRW1LWjRzbG8vZ2Z5WEF6ckszTUV4ZEIzbnFJWmQvbTFIQlBYb0oK";
const SIGNATURE =
  "dW50cnVzdGVkIGNvbW1lbnQ6IHNpZ25hdHVyZSBmcm9tIHRhdXJpIHNlY3JldCBrZXkKUlVUalNXcU5UYW4raHBlOFQzUzU1OGFHNzloQ0JtUHY4UFkwMkNiQjcrUlBHenlnYXdCWUdJS0I5T01CRENzSDhmQjJmcVg4VTVrOVFMWWgyRGxBU0xMVTRJMWZvNENyWEFZPQp0cnVzdGVkIGNvbW1lbnQ6IHRpbWVzdGFtcDoxNzkwNjA5MzI5CWZpbGU6cGF5bG9hZC50eHQKNlNZRjFaRVQzdkxjdVVSenRPMWRnZXRkUzNuSjFaTWtNYUxqUCt0Z0RYSkVxREhKMXFhQVFiZ0wvdzNkYlVnNUdGZHFGT3VMU01hRWliZDJuWEJuQmc9PQo=";
const payload = new TextEncoder().encode("Tune Perfect update payload\n");

describe("verifyMinisign", () => {
  it("accepts a signature made by tauri signer", () => {
    expect(verifyMinisign(payload, SIGNATURE, PUBLIC_KEY)).toBe(true);
  });

  it("rejects modified data", () => {
    const tampered = payload.slice();
    tampered[0] = 0;
    expect(verifyMinisign(tampered, SIGNATURE, PUBLIC_KEY)).toBe(false);
  });

  it("rejects a signature from another key", () => {
    expect(verifyMinisign(payload, SIGNATURE, OTHER_PUBLIC_KEY)).toBe(false);
  });

  it("rejects a modified trusted comment", () => {
    const decoded = atob(SIGNATURE).replace("file:payload.txt", "file:other.txt");
    expect(verifyMinisign(payload, btoa(decoded), PUBLIC_KEY)).toBe(false);
  });

  it("rejects garbage", () => {
    expect(verifyMinisign(payload, btoa("not a signature"), PUBLIC_KEY)).toBe(false);
  });
});
