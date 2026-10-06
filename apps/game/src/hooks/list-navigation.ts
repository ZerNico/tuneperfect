import { access, type MaybeAccessor } from "@solid-primitives/utils";
import { createEffect, createRenderEffect, createSignal, on, onCleanup } from "solid-js";

import { playSound } from "~/lib/sound";

import { createLoop } from "./loop";
import { type Action, type NavigationActions, useNavigation } from "./navigation";

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
  /** More actions on top of moving and confirming, e.g. back. */
  actions?: NavigationActions;
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

  /** The actions stepping back and forth, with how far each one moves the selection. */
  const steps = (): [Action, number][] => {
    const columns = options.columns;
    if (columns !== undefined) {
      return [
        ["left", -1],
        ["right", 1],
        ["up", -columns],
        ["down", columns],
      ];
    }
    const [previous, next] = options.keys ?? ["up", "down"];
    return [
      [previous, -1],
      [next, 1],
    ];
  };

  // A held arrow keeps moving, slower than the raw repeat events (every 50 ms) so it can be followed.
  let lastRepeat = 0;
  const repeatMove = (step: number) => {
    const now = performance.now();
    if (now - lastRepeat < LIST_REPEAT_MS) return;
    lastRepeat = now;
    move(step, true);
  };

  useNavigation(() => {
    const actions: NavigationActions = { ...options.actions };
    // With one item (or none) there's nowhere to move.
    if (options.count > 1) {
      for (const [action, step] of steps()) {
        actions[action] = { down: () => move(step), repeat: () => repeatMove(step) };
      }
    }
    const onActivate = options.onActivate;
    if (onActivate) {
      actions.confirm = {
        down: () => setPressed(true),
        up: () => {
          setPressed(false);
          if (options.count > 0) onActivate(position());
        },
      };
    }
    return { layer: options.layer, enabled: options.enabled, actions };
  });

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
