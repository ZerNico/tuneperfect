import { describe, expect, it, vi } from "vitest";

// The addon isn't built when tests run in CI.
vi.mock("../native", () => ({ native: {}, parseAppError: vi.fn() }));

const { subscription } = await import("./base");

describe("subscription", () => {
  function source() {
    let emit: ((event: number) => void) | undefined;
    let subscribed = 0;
    const subscribe = (next: (event: number) => void) => {
      emit = next;
      subscribed++;
      return () => {
        emit = undefined;
        subscribed--;
      };
    };
    return { subscribe, emit: (event: number) => emit?.(event), subscribed: () => subscribed };
  }

  it("yields events in order, also ones that arrived while nobody was reading", async () => {
    const { subscribe, emit } = source();
    const events = subscription(undefined, subscribe);
    const first = events.next();
    emit(1);
    emit(2);
    emit(3);
    expect(await first).toEqual({ value: 1, done: false });
    expect(await events.next()).toEqual({ value: 2, done: false });
    expect(await events.next()).toEqual({ value: 3, done: false });
    await events.return(undefined);
  });

  it("unsubscribes when the client stops reading", async () => {
    const { subscribe, emit, subscribed } = source();
    const events = subscription(undefined, subscribe);
    const first = events.next();
    emit(1);
    await first;
    expect(subscribed()).toBe(1);

    await events.return(undefined);
    expect(subscribed()).toBe(0);
  });

  it("ends on abort even while waiting for an event that never comes", async () => {
    const { subscribe, subscribed } = source();
    const controller = new AbortController();
    const events = subscription(controller.signal, subscribe);
    const pending = events.next();
    controller.abort();

    expect(await pending).toEqual({ value: undefined, done: true });
    expect(subscribed()).toBe(0);
  });
});
