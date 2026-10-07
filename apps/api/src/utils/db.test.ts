import { describe, expect, it } from "bun:test";

import { isUniqueViolation } from "./db";

describe("isUniqueViolation", () => {
  it("recognises the driver's error and one wrapped by Drizzle", () => {
    expect(isUniqueViolation({ errno: "23505" })).toBe(true);
    expect(isUniqueViolation(Object.assign(new Error("Failed query"), { cause: { errno: "23505" } }))).toBe(true);
  });

  it("ignores other errors", () => {
    expect(isUniqueViolation(new Error("boom"))).toBe(false);
    expect(isUniqueViolation({ errno: "23503" })).toBe(false);
    expect(isUniqueViolation(undefined)).toBe(false);
  });
});
