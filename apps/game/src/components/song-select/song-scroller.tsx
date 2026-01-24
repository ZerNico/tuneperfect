import { type Accessor, createEffect, createMemo, createSignal, For, type JSX, on, onCleanup, onMount } from "solid-js";
import { useNavigation } from "~/hooks/navigation";
import type { LocalSong } from "~/lib/ultrastar/song";

interface VisibleItem {
  item: LocalSong;
  position: number;
}

const ITEM_WIDTH_CQW = 0.12; // w-40 (10cqw) + mx-4 (2cqw) = 12cqw
const MAX_SCALE = 1.3;
const OVERSCAN = 3;

export type SortOption = "artist" | "title" | "year";

// Helper for positive modulo (handles negative numbers correctly)
const mod = (n: number, m: number) => ((n % m) + m) % m;

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

  // Current position (can be any integer, not bounded)
  const currentPosition = () => {
    const width = itemWidth();
    return width === 0 ? 0 : Math.round(offset() / width);
  };

  // Centered song index (0 to length-1, wraps around)
  const centeredIndex = createMemo(() => {
    const length = sortedItems().length;
    if (length === 0) return 0;
    return mod(currentPosition(), length);
  });

  // When sorted items change, find the current item's new index and jump to it
  createEffect(
    on(sortedItems, (items) => {
      const id = currentItemId();
      if (!id || items.length === 0) return;

      const newSongIndex = items.findIndex((item) => item.hash === id);
      if (newSongIndex === -1) return;

      // Preserve the current "cycle" we're in
      const pos = currentPosition();
      const length = items.length;
      const cycle = Math.floor(pos / length);
      const newPosition = cycle * length + newSongIndex;

      if (newPosition !== pos) {
        setOffset(newPosition * itemWidth());
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

  // Virtualization: only render visible items (with wrapping)
  const visibleItems = createMemo(() => {
    const width = itemWidth();
    const items = sortedItems();
    const length = items.length;
    if (width === 0 || length === 0) return [];

    const centerPos = currentPosition();
    const range = Math.ceil(containerWidth() / 2 / width) + OVERSCAN;

    const result: VisibleItem[] = [];
    for (let i = -range; i <= range; i++) {
      const position = centerPos + i;
      const songIndex = mod(position, length);
      // biome-ignore lint/style/noNonNullAssertion: songIndex is always valid due to mod
      result.push({ item: items[songIndex]!, position });
    }
    return result;
  });

  // Get distance from center for a position
  const getDistanceFromCenter = (position: number) => position * itemWidth() - offset();

  // Scale: 1.0 at edges, MAX_SCALE at center
  const getScale = (distance: number) => {
    const width = itemWidth();
    const t = Math.min(Math.abs(distance) / width, 1);
    return MAX_SCALE - t * (MAX_SCALE - 1);
  };

  // Calculate item transform (position + scale + neighbor compensation)
  const getTransform = (position: number) => {
    const width = itemWidth();
    const distance = getDistanceFromCenter(position);
    const scale = getScale(distance);

    // Compensate for scaled neighbors pushing this item
    let neighborOffset = 0;
    for (const { position: otherPos } of visibleItems()) {
      if (otherPos === position) continue;
      const otherDistance = getDistanceFromCenter(otherPos);
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

    const targetPos = snapTarget ?? currentPosition();
    const target = targetPos * width;
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
        const baseIndex = offset() / width;
        const bias = velocity > 0.5 ? 0.3 : velocity < -0.5 ? -0.3 : 0;
        snapTarget = Math.round(baseIndex + bias);
      } else {
        velocity *= 0.92;
      }
    }

    setOffset((o) => o + velocity);
    animationFrame = requestAnimationFrame(animate);
  };

  const startAnimation = () => {
    if (!animationFrame) animationFrame = requestAnimationFrame(animate);
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

    // New gesture: snap to next/prev
    if (timeDelta > 150) {
      goToPosition(currentPosition() + (delta > 0 ? 1 : -1));
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

      // Calculate current position BEFORE updating width
      const prevItemWidth = prevWidth * ITEM_WIDTH_CQW;
      const pos = prevItemWidth > 0 ? Math.round(offset() / prevItemWidth) : 0;

      setContainerWidth(newWidth);

      // Adjust offset to keep the same position after resize
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
      resizeObserver.disconnect();
      containerRef.removeEventListener("wheel", handleWheel);
      if (animationFrame) cancelAnimationFrame(animationFrame);
    });
  });

  return (
    <div ref={containerRef} class={`relative overflow-hidden ${props.class ?? ""}`}>
      <For each={visibleItems()}>
        {({ item, position }) => {
          const t = () => getTransform(position);
          return (
            <div
              class="absolute top-0 flex h-full items-center"
              style={{ transform: `translateX(${t().x}px) scale(${t().scale})` }}
            >
              <div
                onClick={() => goToPosition(position)}
                onKeyDown={(e) => e.key === "Enter" && goToPosition(position)}
              >
                {props.children(item, position, () => t().scale)}
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
