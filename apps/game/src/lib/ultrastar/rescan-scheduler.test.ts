import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRescanScheduler } from "./rescan-scheduler";

interface Result {
  id: number;
  pending: boolean;
}

/** A scheduler whose rescans resolve when the test says so. */
function setup() {
  const runs: ((pending?: boolean) => void)[] = [];
  const applied: number[][] = [];
  let next = 0;
  const scheduler = createRescanScheduler<Result>({
    run: () =>
      new Promise((resolve) => {
        const id = next++;
        runs.push((pending = false) => resolve({ id, pending }));
      }),
    apply: (results) => applied.push(results.map((result) => result.id)),
    isPending: (result) => result.pending,
    onError: () => {},
    interval: 60_000,
    retry: 2_000,
    minGap: 10_000,
  });
  /** Resolves the oldest unresolved rescan and lets the scheduler react. */
  const finish = async (pending?: boolean) => {
    runs.shift()!(pending);
    await vi.advanceTimersByTimeAsync(0);
  };
  return { scheduler, runs, applied, finish };
}

describe("createRescanScheduler", () => {
  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "performance"] }));
  afterEach(() => vi.useRealTimers());

  it("runs one rescan at a time and one more for requests in between", async () => {
    const { scheduler, runs, applied, finish } = setup();
    void scheduler.request();
    void scheduler.request();
    void scheduler.request();
    expect(runs).toHaveLength(1);
    await finish();
    expect(runs).toHaveLength(1);
    await finish();
    expect(applied).toEqual([[0], [1]]);
  });

  it("doesn't start while held and rescans once let go", async () => {
    const { scheduler, runs, applied, finish } = setup();
    const release = scheduler.hold();
    void scheduler.request();
    expect(runs).toHaveLength(0);
    release();
    expect(runs).toHaveLength(1);
    await finish();
    expect(applied).toEqual([[0]]);
  });

  it("keeps a running rescan's result until it's let go", async () => {
    const { scheduler, applied, finish } = setup();
    void scheduler.request();
    const release = scheduler.hold();
    await finish();
    expect(applied).toEqual([]);
    release();
    expect(applied).toEqual([[0]]);
  });

  it("doesn't run a queued follow-up while held", async () => {
    const { scheduler, runs, finish } = setup();
    void scheduler.request();
    void scheduler.request();
    const release = scheduler.hold();
    await finish();
    expect(runs).toHaveLength(0);
    release();
    expect(runs).toHaveLength(1);
  });

  it("waits for every hold", async () => {
    const { scheduler, runs } = setup();
    const first = scheduler.hold();
    const second = scheduler.hold();
    void scheduler.request();
    first();
    first();
    expect(runs).toHaveLength(0);
    second();
    expect(runs).toHaveLength(1);
  });

  it("rescans on its own once started, sooner while folders settle, backing off", async () => {
    const { scheduler, runs, finish } = setup();
    scheduler.start();
    await vi.advanceTimersByTimeAsync(59_999);
    expect(runs).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(runs).toHaveLength(1);

    await finish(true);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(runs).toHaveLength(1);
    await finish(true);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(runs).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(runs).toHaveLength(1);

    // Settled: back to the interval, and the backoff starts over.
    await finish();
    await vi.advanceTimersByTimeAsync(59_999);
    expect(runs).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(1);
    expect(runs).toHaveLength(1);
  });

  it("drops throttled requests right after a rescan", async () => {
    const { scheduler, runs, finish } = setup();
    void scheduler.request();
    await finish();
    void scheduler.request({ throttle: true });
    expect(runs).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(10_000);
    void scheduler.request({ throttle: true });
    expect(runs).toHaveLength(1);
  });

  it("keeps going after a failed rescan", async () => {
    const onError = vi.fn();
    const scheduler = createRescanScheduler({
      run: () => Promise.reject(new Error("gone")),
      apply: () => {},
      isPending: () => false,
      onError,
      interval: 1_000,
      retry: 100,
      minGap: 0,
    });
    scheduler.start();
    await vi.advanceTimersByTimeAsync(2_000);
    expect(onError).toHaveBeenCalledTimes(2);
    scheduler.stop();
    await vi.advanceTimersByTimeAsync(5_000);
    expect(onError).toHaveBeenCalledTimes(2);
  });
});
