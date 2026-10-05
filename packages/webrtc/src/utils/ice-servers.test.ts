import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { createIceServerSource } from "./ice-servers";

const SERVERS_A: RTCIceServer[] = [{ urls: "turn:a", username: "1:a", credential: "a" }];
const SERVERS_B: RTCIceServer[] = [{ urls: "turn:b", username: "2:b", credential: "b" }];
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

  it("refetches when the clock went backwards", async () => {
    const { source, load, advance } = setup(SERVERS_A, SERVERS_B);
    await source();
    advance(-10);
    expect(await source()).toBe(SERVERS_B);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
