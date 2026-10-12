import { describe, expect, it, vi } from "vitest";

vi.mock("~/lib/native/client", () => ({ native: {} }));

const { decodePitchBatch } = await import("./pitch-stream");

describe("decodePitchBatch", () => {
  it("reads the flat layout", () => {
    const batch = new Float64Array([100, 2, 0, 80, 440, 0.5, 2, 81, -1, 0.01]);

    expect(decodePitchBatch(batch)).toEqual({
      sentAt: 100,
      frames: [
        { mic: 0, time: 80, hz: 440, level: 0.5 },
        { mic: 2, time: 81, hz: -1, level: 0.01 },
      ],
    });
  });

  it("handles an empty batch", () => {
    expect(decodePitchBatch(new Float64Array([5, 0]))).toEqual({ sentAt: 5, frames: [] });
  });
});
