import { describe, expect, it } from "bun:test";

import { tryCatch } from "./try-catch";

describe("tryCatch", () => {
  it("returns [null, data] for a resolving promise", async () => {
    const [error, data] = await tryCatch(Promise.resolve(42));

    expect(error).toBeNull();
    expect(data).toBe(42);
  });

  it("returns [error, null] for a rejecting promise", async () => {
    const [error, data] = await tryCatch<never>(Promise.reject(new Error("nope")));

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe("nope");
    expect(data).toBeNull();
  });

  it("supports sync functions", async () => {
    const [error, data] = await tryCatch(() => "sync");

    expect(error).toBeNull();
    expect(data).toBe("sync");
  });

  it("catches errors thrown by sync functions", async () => {
    const [error, data] = await tryCatch(() => {
      throw new Error("sync boom");
    });

    expect((error as Error).message).toBe("sync boom");
    expect(data).toBeNull();
  });

  it("supports async functions", async () => {
    const [error, data] = await tryCatch(async () => "async");

    expect(error).toBeNull();
    expect(data).toBe("async");
  });
});
