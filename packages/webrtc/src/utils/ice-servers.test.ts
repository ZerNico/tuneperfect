import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { createIceServerSource, credentialsExpireAt } from "./ice-servers";

const SERVERS_A: RTCIceServer[] = [{ urls: "turn:a", username: "9999999999:a", credential: "a" }];
const SERVERS_B: RTCIceServer[] = [{ urls: "turn:b", username: "9999999999:b", credential: "b" }];
const FALLBACK: RTCIceServer[] = [{ urls: "stun:stun.l.google.com:19302" }];

function setup(...results: (RTCIceServer[] | Error)[]) {
  let time = 1_000_000;
  const load = mock(async () => {
    const result = results.shift();
    if (!result) throw new Error("no more results");
    if (result instanceof Error) throw result;
    return result;
  });
  const source = createIceServerSource(load, { maxAge: 1_000, staleMaxAge: 5_000, now: () => time });
  return { source, load, advance: (ms: number) => (time += ms) };
}

afterEach(() => {
  mock.restore();
});

describe("createIceServerSource", () => {
  it("keeps the servers until they're too old", async () => {
    const { source, load, advance } = setup(SERVERS_A, SERVERS_B);
    expect(await source()).toBe(SERVERS_A);
    advance(999);
    expect(await source()).toBe(SERVERS_A);
    advance(1);
    expect(await source()).toBe(SERVERS_B);
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("shares one request between concurrent calls", async () => {
    const { source, load } = setup(SERVERS_A);
    const [first, second] = await Promise.all([source(), source()]);
    expect(first).toBe(SERVERS_A);
    expect(second).toBe(SERVERS_A);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it("falls back to public STUN without servers, and tries again next time", async () => {
    spyOn(console, "warn").mockImplementation(() => {});
    const { source } = setup(new Error("offline"), SERVERS_A);
    expect(await source()).toEqual(FALLBACK);
    expect(await source()).toBe(SERVERS_A);
  });

  it("serves the last servers while a refetch fails, until they're too old for that too", async () => {
    spyOn(console, "warn").mockImplementation(() => {});
    const { source, advance } = setup(SERVERS_A, new Error("offline"), new Error("offline"));
    await source();
    advance(4_000);
    expect(await source()).toBe(SERVERS_A);
    advance(1_000);
    expect(await source()).toEqual(FALLBACK);
  });

  it("recovers from a load that throws synchronously", async () => {
    spyOn(console, "warn").mockImplementation(() => {});
    let calls = 0;
    const source = createIceServerSource(() => {
      if (calls++ === 0) throw new Error("sync");
      return Promise.resolve(SERVERS_A);
    });
    expect(await source()).toEqual(FALLBACK);
    expect(await source()).toBe(SERVERS_A);
  });

  it("never serves credentials past their expiry, fresh or as a fallback", async () => {
    spyOn(console, "warn").mockImplementation(() => {});
    let time = 0;
    // Expires 10 minutes in: within the 5-minute margin after 6 minutes.
    const expiring: RTCIceServer[] = [{ urls: "turn:a", username: "600:a", credential: "a" }];
    const results: (RTCIceServer[] | Error)[] = [expiring, new Error("offline"), SERVERS_B];
    const source = createIceServerSource(
      async () => {
        const result = results.shift()!;
        if (result instanceof Error) throw result;
        return result;
      },
      { maxAge: 60 * 60_000, staleMaxAge: 12 * 60 * 60_000, now: () => time },
    );
    expect(await source()).toBe(expiring);
    time = 6 * 60_000;
    // Too close to its expiry to reuse, and the refetch fails: not the expiring ones either.
    expect(await source()).toEqual(FALLBACK);
    expect(await source()).toBe(SERVERS_B);
  });

  it("loads again after being invalidated, keeping the old servers as a fallback", async () => {
    spyOn(console, "warn").mockImplementation(() => {});
    const { source, load } = setup(SERVERS_A, new Error("offline"), SERVERS_B);
    await source();
    source.invalidate();
    expect(await source()).toBe(SERVERS_A);
    source.invalidate();
    expect(await source()).toBe(SERVERS_B);
    expect(load).toHaveBeenCalledTimes(3);
  });

  it("refetches when the clock went backwards", async () => {
    const { source, load, advance } = setup(SERVERS_A, SERVERS_B);
    await source();
    advance(-10);
    expect(await source()).toBe(SERVERS_B);
    expect(load).toHaveBeenCalledTimes(2);
  });
});

describe("credentialsExpireAt", () => {
  it("reads the earliest expiry from coturn REST usernames", () => {
    expect(
      credentialsExpireAt([{ urls: "stun:x" }, { urls: "turn:x", username: "1700000000:ab", credential: "c" }]),
    ).toBe(1_700_000_000_000);
    expect(credentialsExpireAt([{ urls: "turn:x", username: "static-user", credential: "c" }])).toBe(
      Number.POSITIVE_INFINITY,
    );
  });
});
