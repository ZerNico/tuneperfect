/**
 * Window virtualizer on `@tanstack/virtual-core` for Solid 2 (`@tanstack/solid-virtual` is still on Solid 1).
 * Only what the song list needs: a fixed row size, scrolling the page itself.
 */
import {
  observeWindowOffset,
  observeWindowRect,
  type VirtualItem,
  Virtualizer,
  type VirtualizerOptions,
  windowScroll,
} from "@tanstack/virtual-core";
import { type Accessor, createMemo, createRenderEffect, createSignal, onSettled, untrack } from "solid-js";

interface WindowVirtualizerOptions {
  count: number;
  estimateSize: (index: number) => number;
  overscan?: number;
  /** Where the list starts in the page; the virtualizer works in page coordinates. */
  scrollMargin?: number;
}

export function createWindowVirtualizer(options: Accessor<WindowVirtualizerOptions>): {
  items: Accessor<VirtualItem[]>;
  totalSize: Accessor<number>;
} {
  // Bumped whenever the virtualizer has news (scrolling, resizing, new options); that may happen while Solid updates.
  const [version, setVersion] = createSignal(0, { ownedWrite: true });
  const resolve = (current: WindowVirtualizerOptions): VirtualizerOptions<Window, Element> => ({
    ...current,
    getScrollElement: () => window,
    observeElementRect: observeWindowRect,
    observeElementOffset: observeWindowOffset,
    scrollToFn: windowScroll,
    initialOffset: () => window.scrollY,
    onChange: () => setVersion((v) => v + 1),
  });

  const virtualizer = new Virtualizer(resolve(untrack(options)));

  // `_willUpdate` and `_didMount` are the hooks TanStack's own adapters drive the core with.
  /* oxlint-disable eslint/no-underscore-dangle */
  createRenderEffect(options, (current) => {
    virtualizer.setOptions(resolve(current));
    virtualizer._willUpdate();
    setVersion((v) => v + 1);
  });
  onSettled(() => {
    const cleanup = virtualizer._didMount();
    virtualizer._willUpdate();
    return cleanup;
  });
  /* oxlint-enable eslint/no-underscore-dangle */

  return {
    items: createMemo(() => {
      version();
      return virtualizer.getVirtualItems();
    }),
    totalSize: () => {
      version();
      return virtualizer.getTotalSize();
    },
  };
}
