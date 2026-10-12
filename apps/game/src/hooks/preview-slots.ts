import { debounce } from "@solid-primitives/scheduled";
import { type Accessor, createEffect, createSignal, on, onCleanup, type Setter } from "solid-js";

/** How long the selection has to rest before its preview starts. */
const SETTLE_MS = 200;
/** How long the previous preview keeps its slot after a swap, so it can fade out. */
const RELEASE_MS = 600;

export interface PreviewSlot<T> {
  item: Accessor<T | null>;
  /** The active slot with something in it. */
  playing: Accessor<boolean>;
}

/**
 * Two preview slots that take turns, so the next preview loads and fades in while the
 * previous one fades out. A new selection starts once it has rested for `SETTLE_MS`; while
 * the selection keeps changing (scrolling), the current preview stops right away instead of
 * playing on. `key` tells when the selection is still the same item, which mustn't restart.
 *
 * Starts with the current selection in the first slot, so returning to a screen doesn't
 * restart its preview.
 */
export function createPreviewSlots<T>(selected: Accessor<T | null>, key: (item: T) => string) {
  const [first, setFirst] = createSignal<T | null>(selected());
  const [second, setSecond] = createSignal<T | null>(null);
  const items = [first, second];
  const setters: Setter<T | null>[] = [setFirst, setSecond];
  const [active, setActive] = createSignal(0);
  let releaseTimeout: ReturnType<typeof setTimeout> | undefined;
  let pending = false;

  const slot = (index: number) => items[index]!;
  const setSlot = (index: number) => setters[index]!;

  const stop = () => {
    clearTimeout(releaseTimeout);
    setSlot(active())(null);
  };

  const swapTo = (item: T | null) => {
    const current = active();
    const playing = slot(current)();
    if (item && playing && key(playing) === key(item)) return;

    clearTimeout(releaseTimeout);
    const next = 1 - current;
    setSlot(next)(() => item);
    setActive(next);
    releaseTimeout = setTimeout(() => setSlot(current)(null), RELEASE_MS);
  };

  // Cleared with the owner, like the timeout below.
  // oxlint-disable-next-line solid/reactivity
  const settle = debounce((item: T | null) => {
    pending = false;
    swapTo(item);
  }, SETTLE_MS);

  createEffect(
    on(selected, (item) => {
      if (pending) stop();
      pending = true;
      settle(item);
    }),
  );

  onCleanup(() => clearTimeout(releaseTimeout));

  return [0, 1].map((index): PreviewSlot<T> => ({
    item: slot(index),
    playing: () => active() === index && slot(index)() !== null,
  }));
}
