import { describe, expect, it } from "vitest";

import { DeliveryClock } from "./delivery-clock";

describe("DeliveryClock", () => {
  it("knows nothing before the first batch", () => {
    expect(new DeliveryClock().toLocal(100)).toBeUndefined();
  });

  it("maps audio times with the fastest delivery, ignoring late batches", () => {
    const clock = new DeliveryClock();
    // The audio clock runs 1000 ms behind performance.now(); deliveries take 2 to 30 ms.
    clock.observe(0, 1002);
    clock.observe(18, 1048); // 30 ms late
    clock.observe(36, 1039);
    expect(clock.toLocal(18)).toBe(1020);
  });

  it("forgets old deliveries, so it follows the clocks if they drift", () => {
    const clock = new DeliveryClock();
    clock.observe(0, 1001);
    for (let sent = 18; sent <= 7000; sent += 18) clock.observe(sent, sent + 1004);
    expect(clock.toLocal(7000)).toBe(8004);
  });

  it("starts over on reset", () => {
    const clock = new DeliveryClock();
    clock.observe(0, 1000);
    clock.reset();
    expect(clock.toLocal(0)).toBeUndefined();
  });
});
