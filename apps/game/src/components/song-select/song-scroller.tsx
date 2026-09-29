import { Key } from "@solid-primitives/keyed";
import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  on,
  onCleanup,
  onMount,
  type Ref,
} from "solid-js";

import { useNavigation } from "~/hooks/navigation";
import { createRefContent } from "~/lib/utils/ref";

export interface SongScrollerRef<T> {
  goToRandomSong: () => T | null;
}

interface VisibleItem<T> {
  item: T;
  position: number;
}

const ITEM_WIDTH_CQW = 0.12;
const MAX_SCALE = 1.3;

export interface ScrollerItemState {
  scale: number;
  /** 0 at rest, 1 when centred. */
  emphasis: number;
  /** Signed distance from the centre in item widths (negative = left). */
  offset: number;
}
const OVERSCAN = 3;

const mod = (n: number, m: number) => ((n % m) + m) % m;

interface SongScrollerProps<T> {
  ref?: Ref<SongScrollerRef<T>>;
  /** Already filtered and sorted. */
  items: T[];
  getId: (item: T) => string;
  initialId?: string;
  children: (item: T, index: number, state: Accessor<ScrollerItemState>) => JSX.Element;
  onCenteredItemChange?: (item: T | null, index: number) => void;
  onConfirm?: (item: T) => void;
  class?: string;
}

/** Infinite horizontal coverflow with momentum, snapping and pointer drag. */
export function SongScroller<T>(props: SongScrollerProps<T>) {
  let containerRef!: HTMLDivElement;

  const [offset, setOffset] = createSignal(0);
  const [containerWidth, setContainerWidth] = createSignal(0);
  const [currentItemId, setCurrentItemId] = createSignal<string | null>(null);
  const [hasInitialized, setHasInitialized] = createSignal(false);

  const itemWidth = () => containerWidth() * ITEM_WIDTH_CQW;

  const filteredAndSortedItems = () => props.items;

  const continuousPosition = createMemo(() => {
    const width = itemWidth();
    return width === 0 ? 0 : offset() / width;
  });

  const currentPosition = createMemo(() => Math.round(continuousPosition()));

  const centeredIndex = createMemo(() => {
    const length = filteredAndSortedItems().length;
    if (length === 0) return 0;
    return mod(currentPosition(), length);
  });

  createEffect(
    on(
      () => [props.initialId, filteredAndSortedItems(), containerWidth()] as const,
      ([initialId, items, width]) => {
        if (hasInitialized() || items.length === 0 || width === 0) return;

        // If we have an initial song, find it and scroll to it
        if (initialId) {
          const index = items.findIndex((item) => props.getId(item) === initialId);
          const initialItem = items[index];
          if (initialItem) {
            const calculatedItemWidth = width * ITEM_WIDTH_CQW;
            setOffset(index * calculatedItemWidth);
            setCurrentItemId(initialId);
            setHasInitialized(true);
            props.onCenteredItemChange?.(initialItem, index);
            return;
          }
        }

        // No initial song or not found - default to first item
        const firstSong = items[0];
        if (firstSong) {
          setCurrentItemId(props.getId(firstSong));
          setOffset(0);
          setHasInitialized(true);
          props.onCenteredItemChange?.(firstSong, 0);
        }
      },
    ),
  );

  createEffect(
    on(filteredAndSortedItems, (items) => {
      // Skip if not initialized yet - let the initialization effect handle it
      if (!hasInitialized()) return;

      const id = currentItemId();

      if (items.length === 0) {
        if (id) {
          setCurrentItemId(null);
          props.onCenteredItemChange?.(null, -1);
        }
        return;
      }

      if (!id) {
        const firstSong = items[0];
        if (firstSong) {
          setCurrentItemId(props.getId(firstSong));
          setOffset(0);
          props.onCenteredItemChange?.(firstSong, 0);
        }
        return;
      }

      const newSongIndex = items.findIndex((item) => props.getId(item) === id);
      if (newSongIndex === -1) {
        const firstSong = items[0];
        if (firstSong) {
          setCurrentItemId(props.getId(firstSong));
          setOffset(0);
          props.onCenteredItemChange?.(firstSong, 0);
        }
        return;
      }

      // Preserve the current "cycle" in infinite scroll
      const pos = currentPosition();
      const length = items.length;
      const cycle = Math.floor(pos / length);
      const newPosition = cycle * length + newSongIndex;

      if (newPosition !== pos) {
        setOffset(newPosition * itemWidth());
      }
    }),
  );

  createEffect(
    on(centeredIndex, (index) => {
      // Skip if not initialized yet - let the initialization effect handle first selection
      if (!hasInitialized()) return;

      const items = filteredAndSortedItems();
      const item = items[index];
      if (item) {
        setCurrentItemId(props.getId(item));
        props.onCenteredItemChange?.(item, index);
      }
    }),
  );

  const visibleRange = createMemo(
    () => {
      const width = itemWidth();
      if (width === 0) return { start: 0, end: 0 };

      const centerPos = continuousPosition();
      const range = Math.ceil(containerWidth() / 2 / width) + OVERSCAN;
      return { start: Math.floor(centerPos) - range, end: Math.ceil(centerPos) + range };
      // Only a changed range should rebuild the visible list, not every frame of movement.
    },
    undefined,
    { equals: (a, b) => a.start === b.start && a.end === b.end },
  );

  const visibleItems = createMemo(() => {
    const items = filteredAndSortedItems();
    const length = items.length;
    if (length === 0) return [];

    const { start, end } = visibleRange();
    const result: VisibleItem<T>[] = [];
    for (let position = start; position <= end; position++) {
      const songIndex = mod(position, length);
      result.push({ item: items[songIndex]!, position });
    }
    return result;
  });

  const itemTransforms = createMemo(() => {
    const width = itemWidth();
    const containerW = containerWidth();
    const currentOffset = offset();
    const visible = visibleItems();

    if (width === 0 || visible.length === 0) return new Map<number, { x: number; scale: number; offset: number }>();

    const itemData: { position: number; distance: number; scale: number }[] = [];
    const scaledItems: { distance: number; extra: number }[] = [];

    for (const { position } of visible) {
      const distance = position * width - currentOffset;
      const t = Math.min(Math.abs(distance) / width, 1);
      const scale = MAX_SCALE - t * (MAX_SCALE - 1);
      itemData.push({ position, distance, scale });

      if (scale > 1) {
        scaledItems.push({ distance, extra: ((scale - 1) * width) / 2 });
      }
    }

    const result = new Map<number, { x: number; scale: number; offset: number }>();
    for (const { position, distance, scale } of itemData) {
      let neighborOffset = 0;

      for (const scaled of scaledItems) {
        if (scaled.distance === distance) continue;
        if (distance > 0 && scaled.distance < distance) neighborOffset += scaled.extra;
        else if (distance < 0 && scaled.distance > distance) neighborOffset -= scaled.extra;
      }

      const x = containerW / 2 - width / 2 + distance + neighborOffset;
      result.set(position, { x, scale, offset: distance / width });
    }

    return result;
  });

  let velocity = 0;
  let lastWheelTime = 0;
  let animationFrame: number | undefined;
  let snapTarget: number | null = null;
  let holdDirection = 0;
  let mounted = true;
  let lastFrameTime = 0;

  const TARGET_FRAME_MS = 1000 / 60;

  const animate = (currentTime: number) => {
    if (!mounted) {
      animationFrame = undefined;
      return;
    }

    const width = itemWidth();
    if (width === 0) {
      animationFrame = undefined;
      return;
    }

    const deltaTime = lastFrameTime === 0 ? TARGET_FRAME_MS : currentTime - lastFrameTime;
    lastFrameTime = currentTime;
    const deltaFactor = deltaTime / TARGET_FRAME_MS;

    const targetPos = snapTarget ?? currentPosition();
    const target = targetPos * width;
    const distance = target - offset();

    let frameVelocity = 0;

    if (snapTarget !== null) {
      if (Math.abs(distance) < 0.5) {
        setOffset(target);
        velocity = 0;
        snapTarget = null;
        animationFrame = undefined;
        lastFrameTime = 0;
        return;
      }
      const lerpFactor = 1 - 0.85 ** deltaFactor;
      frameVelocity = distance * lerpFactor;
      velocity = 0;
    } else if (holdDirection !== 0) {
      const holdSpeed = itemWidth() * 0.13 * deltaFactor;
      frameVelocity = holdDirection * holdSpeed;
    } else {
      if (Math.abs(velocity) < 2) {
        const baseIndex = offset() / width;
        const fractional = baseIndex - Math.floor(baseIndex);
        const velocityBias = Math.abs(velocity) > 1 ? Math.sign(velocity) * 0.15 : 0;

        if (fractional < 0.4 - velocityBias) {
          snapTarget = Math.floor(baseIndex);
        } else if (fractional > 0.6 + velocityBias) {
          snapTarget = Math.ceil(baseIndex);
        } else {
          snapTarget = Math.round(baseIndex + velocityBias);
        }
      } else {
        const baseDamping = Math.abs(velocity) < 5 ? 0.88 : 0.92;
        const dampingFactor = baseDamping ** deltaFactor;
        frameVelocity = (velocity * (1 - dampingFactor)) / -Math.log(baseDamping);
        velocity *= dampingFactor;
      }
    }

    setOffset((o) => o + frameVelocity);
    animationFrame = requestAnimationFrame(animate);
  };

  const startAnimation = () => {
    if (!animationFrame) {
      lastFrameTime = 0;
      animationFrame = requestAnimationFrame(animate);
    }
  };

  const goToPosition = (position: number) => {
    snapTarget = position;
    velocity = 0;
    startAnimation();
  };

  const handleWheel = (e: WheelEvent) => {
    const delta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
    if (delta === 0) return;
    e.preventDefault();

    const now = performance.now();
    const timeDelta = now - lastWheelTime;
    lastWheelTime = now;

    if (timeDelta > 150) {
      goToPosition(currentPosition() + (delta > 0 ? 1 : -1));
      return;
    }

    snapTarget = null;
    const deltaFactor = timeDelta / TARGET_FRAME_MS;
    const scaledDelta = delta * 0.5 * deltaFactor;
    velocity = velocity + scaledDelta;
    velocity = Math.max(-50, Math.min(50, velocity));
    startAnimation();
  };

  // Pointer drag: the strip follows the pointer; on release the drag speed
  // becomes the fling velocity and the regular friction/snap takes over.
  const DRAG_THRESHOLD_PX = 6;
  let dragPointerId: number | null = null;
  let dragStartX = 0;
  let dragLastX = 0;
  let dragLastTime = 0;
  let dragVelocity = 0;
  let dragMoved = false;
  let suppressClick = false;
  const [grabbing, setGrabbing] = createSignal(false);

  const handlePointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    dragPointerId = e.pointerId;
    dragStartX = dragLastX = e.clientX;
    dragLastTime = performance.now();
    dragVelocity = 0;
    dragMoved = false;
  };

  const handlePointerMove = (e: PointerEvent) => {
    if (e.pointerId !== dragPointerId) return;

    if (!dragMoved) {
      if (Math.abs(e.clientX - dragStartX) < DRAG_THRESHOLD_PX) return;
      // Only capture once it's a real drag, so plain clicks still reach the items.
      dragMoved = true;
      setGrabbing(true);
      containerRef.setPointerCapture(e.pointerId);
      snapTarget = null;
      velocity = 0;
      holdDirection = 0;
      if (animationFrame) {
        cancelAnimationFrame(animationFrame);
        animationFrame = undefined;
      }
      dragLastX = e.clientX;
    }

    const now = performance.now();
    const dx = e.clientX - dragLastX;
    const dt = Math.max(1, now - dragLastTime);
    setOffset((o) => o - dx);
    // Smoothed, in the same px-per-frame units the physics uses.
    dragVelocity = 0.7 * ((-dx / dt) * TARGET_FRAME_MS) + 0.3 * dragVelocity;
    dragLastX = e.clientX;
    dragLastTime = now;
  };

  const handlePointerUp = (e: PointerEvent) => {
    if (e.pointerId !== dragPointerId) return;
    dragPointerId = null;
    if (!dragMoved) return;

    setGrabbing(false);
    suppressClick = true;
    requestAnimationFrame(() => (suppressClick = false));
    // A pause before releasing means "place it here", not "fling".
    const idle = performance.now() - dragLastTime > 80;
    velocity = idle ? 0 : Math.max(-50, Math.min(50, dragVelocity));
    snapTarget = null;
    startAnimation();
  };

  const goToRandomSong = (): T | null => {
    const items = filteredAndSortedItems();
    if (items.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * items.length);
    const randomSong = items[randomIndex];
    if (!randomSong) return null;

    setOffset(randomIndex * itemWidth());
    setCurrentItemId(props.getId(randomSong));

    return randomSong;
  };

  createRefContent(
    () => props.ref,
    () => ({ goToRandomSong }),
  );

  useNavigation({
    onKeydown(event) {
      if (event.action === "left") goToPosition(currentPosition() - 1);
      else if (event.action === "right") goToPosition(currentPosition() + 1);
    },
    onHold(event) {
      if (event.action === "left" || event.action === "right") {
        holdDirection = event.action === "left" ? -1 : 1;
        snapTarget = null;
        startAnimation();
      }
    },
    onKeyup(event) {
      if (event.action === "left" || event.action === "right") {
        holdDirection = 0;
        velocity = 0;
      }
    },
  });

  onMount(() => {
    const updateSize = () => {
      const prevWidth = containerWidth();
      const newWidth = containerRef.clientWidth;
      const prevItemWidth = prevWidth * ITEM_WIDTH_CQW;
      const pos = prevItemWidth > 0 ? Math.round(offset() / prevItemWidth) : 0;

      setContainerWidth(newWidth);

      if (prevWidth > 0 && newWidth !== prevWidth) {
        const newItemWidth = newWidth * ITEM_WIDTH_CQW;
        setOffset(pos * newItemWidth);
      }
    };
    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(containerRef);
    containerRef.addEventListener("wheel", handleWheel, { passive: false });

    onCleanup(() => {
      mounted = false;
      resizeObserver.disconnect();
      containerRef.removeEventListener("wheel", handleWheel);
      if (animationFrame) cancelAnimationFrame(animationFrame);
    });
  });

  const handleItemClick = (item: T, position: number) => {
    const isCentered = position === currentPosition();
    if (isCentered) {
      props.onConfirm?.(item);
    } else {
      goToPosition(position);
    }
  };

  return (
    <div
      ref={containerRef}
      class={`relative touch-pan-y overflow-hidden select-none ${props.class ?? ""}`}
      classList={{ "cursor-grab": !grabbing(), "cursor-grabbing": grabbing() }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onDragStart={(e) => e.preventDefault()}
    >
      {/* Keyed by position + song so a cover keeps its DOM (and loaded image) while visible. */}
      <Key each={visibleItems()} by={(visible) => `${visible.position}:${props.getId(visible.item)}`}>
        {(visible) => {
          const { item, position } = visible();
          const t = () => itemTransforms().get(position) ?? { x: 0, scale: 1, offset: 0 };
          return (
            <div
              class="absolute top-0 flex h-full items-center"
              style={{
                transform: `translateX(${t().x}px) scale(${t().scale})`,
                "will-change": "transform",
                // No paint containment: cards may draw outside their box (e.g. the vinyl).
                contain: "layout style",
              }}
            >
              <div
                onClick={() => !suppressClick && handleItemClick(item, position)}
                onKeyDown={(e) => e.key === "Enter" && handleItemClick(item, position)}
              >
                {props.children(item, position, () => ({
                  scale: t().scale,
                  emphasis: (t().scale - 1) / (MAX_SCALE - 1),
                  offset: t().offset,
                }))}
              </div>
            </div>
          );
        }}
      </Key>
    </div>
  );
}
