import { type Accessor, createEffect, createMemo, createSignal, For, type JSX, on, onCleanup, onMount } from "solid-js";
import { useNavigation } from "~/hooks/navigation";
import type { LocalSong } from "~/lib/ultrastar/song";
import { clamp } from "~/lib/utils/math";

const ITEM_WIDTH_CQW = 0.12; // w-40 (10cqw) + mx-4 (2cqw) = 12cqw
const MAX_SCALE = 1.3;
const OVERSCAN = 3;

export type SortOption = "artist" | "title" | "year";

interface SongScrollerProps {
  items: LocalSong[];
  sort: SortOption;
  children: (item: LocalSong, index: number, scale: Accessor<number>) => JSX.Element;
  onCenteredItemChange?: (item: LocalSong, index: number) => void;
  class?: string;
}

export function SongScroller(props: SongScrollerProps) {
  let containerRef!: HTMLDivElement;

  const [offset, setOffset] = createSignal(0);
  const [containerWidth, setContainerWidth] = createSignal(0);
  const [currentItemId, setCurrentItemId] = createSignal<string | null>(null);

  const itemWidth = () => containerWidth() * ITEM_WIDTH_CQW;

  // Sort items based on sort option
  const compare = (a: string, b: string) => a.localeCompare(b, undefined, { sensitivity: "base" });

  const sortedItems = createMemo(() => {
    const items = props.items;
    const sortBy = props.sort;

    return [...items].sort((a, b) => {
      if (sortBy === "artist") {
        return compare(a.artist, b.artist) || compare(a.title, b.title);
      }
      if (sortBy === "title") {
        return compare(a.title, b.title);
      }
      if (sortBy === "year") {
        return (a.year ?? 0) - (b.year ?? 0) || compare(a.artist, b.artist) || compare(a.title, b.title);
      }
      return 0;
    });
  });

  const maxOffset = () => Math.max(0, (sortedItems().length - 1) * itemWidth());
  const clampOffset = (value: number) => clamp(value, 0, maxOffset());

  const centeredIndex = createMemo(() => {
    const width = itemWidth();
    return width === 0 ? 0 : Math.round(offset() / width);
  });

  // When sorted items change, find the current item's new index and jump to it
  createEffect(
    on(sortedItems, (items) => {
      const id = currentItemId();
      if (!id || items.length === 0) return;

      const newIndex = items.findIndex((item) => item.hash === id);
      if (newIndex !== -1 && newIndex !== centeredIndex()) {
        // Immediately jump to the new index (no animation)
        setOffset(newIndex * itemWidth());
      }
    }),
  );

  // Notify when centered item changes and track current item
  createEffect(
    on(centeredIndex, (index) => {
      const item = sortedItems()[index];
      if (item) {
        setCurrentItemId(item.hash);
        props.onCenteredItemChange?.(item, index);
      }
    }),
  );

  // Virtualization: only render visible items
  const visibleItems = createMemo(() => {
    const width = itemWidth();
    const center = centeredIndex();
    const items = sortedItems();
    const range = width === 0 ? 10 : Math.ceil(containerWidth() / 2 / width) + OVERSCAN;
    const start = Math.max(0, center - range);
    const end = Math.min(items.length - 1, center + range);

    return items.slice(start, end + 1).map((item, i) => ({ item, index: start + i }));
  });

  // Get distance from center for an item (negative = left of center)
  const getDistanceFromCenter = (index: number) => index * itemWidth() - offset();

  // Scale: 1.0 at edges, MAX_SCALE at center
  const getScale = (distance: number) => {
    const width = itemWidth();
    const t = Math.min(Math.abs(distance) / width, 1);
    return MAX_SCALE - t * (MAX_SCALE - 1);
  };

  // Calculate item transform (position + scale + neighbor compensation)
  const getTransform = (index: number) => {
    const width = itemWidth();
    const distance = getDistanceFromCenter(index);
    const scale = getScale(distance);

    // Compensate for scaled neighbors pushing this item
    let neighborOffset = 0;
    for (const { index: i } of visibleItems()) {
      if (i === index) continue;
      const otherDistance = getDistanceFromCenter(i);
      const otherScale = getScale(otherDistance);
      if (otherScale <= 1) continue;

      const extra = ((otherScale - 1) * width) / 2;
      if (distance > 0 && otherDistance < distance) neighborOffset += extra;
      else if (distance < 0 && otherDistance > distance) neighborOffset -= extra;
    }

    const x = containerWidth() / 2 - width / 2 + distance + neighborOffset;
    return { x, scale };
  };

  // Animation
  let velocity = 0;
  let lastWheelTime = 0;
  let animationFrame: number | undefined;
  let snapTarget: number | null = null;
  let holdDirection = 0; // -1 = left, 0 = none, 1 = right

  const animate = () => {
    const width = itemWidth();
    if (width === 0) {
      animationFrame = undefined;
      return;
    }

    const target = clampOffset((snapTarget ?? centeredIndex()) * width);
    const distance = target - offset();

    if (snapTarget !== null) {
      // Snapping: ease toward target
      if (Math.abs(distance) < 0.5) {
        setOffset(target);
        velocity = 0;
        snapTarget = null;
        animationFrame = undefined;
        return;
      }
      velocity = distance * 0.15;
    } else if (holdDirection !== 0) {
      // Holding: continuous scroll in direction
      const holdSpeed = itemWidth() * 0.13;
      velocity = holdDirection * holdSpeed;
    } else {
      // Free scroll: apply friction, then snap when slow
      if (Math.abs(velocity) < 2) {
        // Consider velocity direction when choosing snap target
        const currentOffset = offset();
        const baseIndex = currentOffset / width;
        // If moving right (positive velocity), round up more easily; if left, round down
        const bias = velocity > 0.5 ? 0.3 : velocity < -0.5 ? -0.3 : 0;
        snapTarget = clamp(Math.round(baseIndex + bias), 0, sortedItems().length - 1);
      } else {
        velocity *= 0.92;
      }
    }

    setOffset((o) => clampOffset(o + velocity));
    animationFrame = requestAnimationFrame(animate);
  };

  const startAnimation = () => {
    if (!animationFrame) animationFrame = requestAnimationFrame(animate);
  };

  const goToIndex = (index: number) => {
    snapTarget = Math.max(0, Math.min(sortedItems().length - 1, index));
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

    // New gesture: snap to next/prev
    if (timeDelta > 150) {
      goToIndex(centeredIndex() + (delta > 0 ? 1 : -1));
      velocity = delta > 0 ? 5 : -5;
      return;
    }

    // Continuous scroll: build velocity
    snapTarget = null;
    velocity = timeDelta < 50 ? velocity + delta * 0.5 : delta;
    velocity = Math.max(-50, Math.min(50, velocity));
    startAnimation();
  };

  useNavigation({
    onKeydown(event) {
      if (event.action === "left") goToIndex(centeredIndex() - 1);
      else if (event.action === "right") goToIndex(centeredIndex() + 1);
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

      // Calculate centered index BEFORE updating width
      const prevItemWidth = prevWidth * ITEM_WIDTH_CQW;
      const currentIndex = prevItemWidth > 0 ? Math.round(offset() / prevItemWidth) : 0;

      setContainerWidth(newWidth);

      // Adjust offset to keep the same item centered after resize
      if (prevWidth > 0 && newWidth !== prevWidth) {
        const newItemWidth = newWidth * ITEM_WIDTH_CQW;
        setOffset(currentIndex * newItemWidth);
      }
    };
    updateSize();

    const resizeObserver = new ResizeObserver(updateSize);
    resizeObserver.observe(containerRef);
    containerRef.addEventListener("wheel", handleWheel, { passive: false });

    onCleanup(() => {
      resizeObserver.disconnect();
      containerRef.removeEventListener("wheel", handleWheel);
      if (animationFrame) cancelAnimationFrame(animationFrame);
    });
  });

  return (
    <div ref={containerRef} class={`relative overflow-hidden ${props.class ?? ""}`}>
      <For each={visibleItems()}>
        {({ item, index }) => {
          const t = () => getTransform(index);
          return (
            <div
              class="absolute top-0 flex h-full items-center"
              style={{ transform: `translateX(${t().x}px) scale(${t().scale})` }}
            >
              <div onClick={() => goToIndex(index)} onKeyDown={(e) => e.key === "Enter" && goToIndex(index)}>
                {props.children(item, index, () => t().scale)}
              </div>
            </div>
          );
        }}
      </For>
    </div>
  );
}

interface SongCardProps {
  song: LocalSong;
}

export function SongCard(props: SongCardProps) {
  return (
    <button
      type="button"
      class="relative mx-4 aspect-square w-40 cursor-pointer overflow-hidden rounded-lg shadow-md transition-transform duration-250 active:scale-95"
    >
      <img class="relative z-1 h-full w-full object-cover" src={props.song.coverUrl ?? ""} alt={props.song.title} />
      <div class="absolute inset-0 bg-black" />
    </button>
  );
}
