import { createRoot, createSignal } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createPreviewSlots } from "./preview-slots";

type Song = { id: string };
const song = (id: string): Song => ({ id });

describe("createPreviewSlots", () => {
  let dispose: () => void;

  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    dispose();
    vi.useRealTimers();
  });

  function setup(initial: Song | null = null) {
    const [selected, select] = createSignal<Song | null>(initial);
    const slots = createRoot((d) => {
      dispose = d;
      return createPreviewSlots(selected, (item) => item.id);
    });
    // The screen's first selection settles like any other.
    vi.advanceTimersByTime(200);
    const playing = () => slots.find((slot) => slot.playing())?.item()?.id ?? null;
    const loaded = () => slots.map((slot) => slot.item()?.id ?? null);
    return { select, playing, loaded };
  }

  it("keeps playing the selection it starts with", () => {
    const { playing } = setup(song("a"));
    vi.advanceTimersByTime(1000);
    expect(playing()).toBe("a");
  });

  it("starts a selection once it has settled, keeping the old one to fade out", () => {
    const { select, playing, loaded } = setup(song("a"));

    select(song("b"));
    vi.advanceTimersByTime(199);
    expect(playing()).toBe("a");

    vi.advanceTimersByTime(1);
    expect(playing()).toBe("b");
    expect(loaded()).toEqual(["a", "b"]);

    vi.advanceTimersByTime(600);
    expect(loaded()).toEqual([null, "b"]);
  });

  it("stops right away while the selection keeps changing", () => {
    const { select, playing } = setup(song("a"));

    select(song("b"));
    vi.advanceTimersByTime(100);
    select(song("c"));
    expect(playing()).toBeNull();

    vi.advanceTimersByTime(200);
    expect(playing()).toBe("c");
  });

  it("doesn't restart when the same item comes back", () => {
    const { select, loaded } = setup(song("a"));

    select({ id: "a" });
    vi.advanceTimersByTime(1000);
    expect(loaded()).toEqual(["a", null]);
  });

  it("goes quiet for an empty selection", () => {
    const { select, playing } = setup(song("a"));

    select(null);
    vi.advanceTimersByTime(200);
    expect(playing()).toBeNull();
  });
});
