import { access, type MaybeAccessor } from "@solid-primitives/utils";
import { createEffect, createRenderEffect, createSignal, on, onCleanup } from "solid-js";

import { playSound } from "~/lib/sound";

import { createLoop } from "./loop";
import { type NavigationEvent, useNavigation } from "./navigation";

type Action = NavigationEvent["action"];

const LIST_REPEAT_MS = 120;

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

  const scrollToSelected = (behavior: ScrollBehavior = "smooth") => {
    elements.get(position())?.scrollIntoView({
      behavior,
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

  /** Steps like the arrow keys do, scrolling the new item into view. A held key stops at the ends. */
  const move = (delta: number, held = false) => {
    const count = options.count;
    if (count === 0) return;
    if (held) {
      const target = position() + delta;
      if (target < 0 || target >= count) return;
    }
    if (options.columns !== undefined) moveInGrid(delta);
    else if (options.wrap === false) set(position() + delta);
    else if (delta > 0) increment();
    else decrement();
    // Smooth scrolling can't keep up with a held key; it would lag behind the selection.
    scrollToSelected(held ? "instant" : "smooth");
  };

  /** How far an action moves the selection, or null when it's not a movement. */
  const stepFor = (action: Action): number | null => {
    const columns = options.columns;
    if (columns !== undefined) {
      if (action === "left") return -1;
      if (action === "right") return 1;
      if (action === "up") return -columns;
      if (action === "down") return columns;
      return null;
    }
    const [previous, next] = options.keys ?? ["up", "down"];
    if (action === previous) return -1;
    if (action === next) return 1;
    return null;
  };

  // A held arrow keeps moving, slower than the raw repeat events (every 50 ms) so it can be followed.
  let lastRepeat = 0;

  useNavigation(() => ({
    layer: options.layer,
    enabled: options.enabled,
    onKeydown(event) {
      const step = stepFor(event.action);
      if (step !== null) move(step);
      else if (event.action === "confirm" && options.onActivate) setPressed(true);
      else options.onKeydown?.(event);
    },
    onRepeat(event) {
      const step = stepFor(event.action);
      const now = performance.now();
      if (step === null || now - lastRepeat < LIST_REPEAT_MS) return;
      lastRepeat = now;
      move(step, true);
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
