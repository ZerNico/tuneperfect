import { access, type MaybeAccessor } from "@solid-primitives/utils";
import { createEffect, createRenderEffect, createSignal, on, onCleanup } from "solid-js";

import { playSound } from "~/lib/sound";

import { createLoop } from "./loop";
import { type NavigationEvent, useNavigation } from "./navigation";

type Action = NavigationEvent["action"];

interface ListNavigationOptions {
  count: number;
  layer?: number;
  enabled?: boolean;
  /** Items per row: left/right step through all items (wrapping), up/down move a row (stopping at the edges). */
  columns?: number;
  /** Without columns: the actions stepping back and forth. Defaults to up/down. */
  keys?: readonly [previous: Action, next: Action];
  /** Without columns: whether the ends wrap around. Defaults to true. */
  wrap?: boolean;
  /** Where the selected item scrolls to when moved to by key. Defaults to "nearest". */
  scrollBlock?: ScrollLogicalPosition;
  /** Play the "select" sound when the position changes. Defaults to true. */
  sound?: boolean;
  /** Confirm on the selected item: pressed while the key is down, activated when it's released. */
  onActivate?: (index: number) => void;
  /** Every key the list doesn't handle itself. */
  onKeydown?: (event: NavigationEvent) => void;
}

/**
 * Keyboard/gamepad navigation for a list or grid. Pass reactive values as getters.
 * Only moves by key scroll the selected item into view (register items with `itemRef`), so hovering never scrolls.
 */
export function createListNavigation(options: ListNavigationOptions) {
  const { position, set, increment, decrement } = createLoop(() => options.count);
  const [pressed, setPressed] = createSignal(false);
  const elements = new Map<number, HTMLElement>();

  const scrollToSelected = () => {
    elements.get(position())?.scrollIntoView({
      behavior: "smooth",
      block: options.scrollBlock ?? "nearest",
      inline: "nearest",
    });
  };

  const moveInGrid = (delta: number) => {
    const count = options.count;
    const columns = options.columns ?? 1;
    const next = position() + delta;
    if (Math.abs(delta) === 1) set((next + count) % count);
    else if (next >= 0 && next < count) set(next);
    // Down from a row above the last one, where the column is empty: the last item.
    else if (delta > 0 && Math.floor(position() / columns) < Math.floor((count - 1) / columns)) set(count - 1);
  };

  /** Steps like the arrow keys do, scrolling the new item into view. */
  const move = (delta: number) => {
    if (options.count === 0) return;
    if (options.columns !== undefined) moveInGrid(delta);
    else if (options.wrap === false) set(position() + delta);
    else if (delta > 0) increment();
    else decrement();
    scrollToSelected();
  };

  useNavigation(() => ({
    layer: options.layer,
    enabled: options.enabled,
    onKeydown(event) {
      const columns = options.columns;
      const [previous, next] = options.keys ?? ["up", "down"];
      if (columns !== undefined && event.action === "left") move(-1);
      else if (columns !== undefined && event.action === "right") move(1);
      else if (columns !== undefined && event.action === "up") move(-columns);
      else if (columns !== undefined && event.action === "down") move(columns);
      else if (columns === undefined && event.action === previous) move(-1);
      else if (columns === undefined && event.action === next) move(1);
      else if (event.action === "confirm" && options.onActivate) setPressed(true);
      else options.onKeydown?.(event);
    },
    onKeyup(event) {
      if (event.action !== "confirm" || !options.onActivate) return;
      setPressed(false);
      if (options.count > 0) options.onActivate(position());
    },
  }));

  createEffect(on(position, () => options.sound !== false && playSound("select"), { defer: true }));

  /** Registers an item's element for scrolling; pass a reactive index if items can move. -1 skips it. */
  const itemRef = (index: MaybeAccessor<number>) => (element: HTMLElement) => {
    createRenderEffect(() => {
      const current = access(index);
      if (current < 0) return;
      elements.set(current, element);
      onCleanup(() => {
        if (elements.get(current) === element) elements.delete(current);
      });
    });
  };

  return {
    position,
    set,
    pressed,
    isSelected: (index: number) => position() === index,
    move,
    scrollToSelected,
    itemRef,
  };
}
