import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  on,
  onCleanup,
  onMount,
  type Ref,
} from "solid-js";
import { useNavigation } from "~/hooks/navigation";
import { type SearchFilter, type SortOption, useSongFilter } from "~/hooks/use-song-filter";
import type { LocalSong } from "~/lib/ultrastar/song";
import { createRefContent } from "~/lib/utils/ref";

export type { SortOption, SearchFilter };

export interface SongScrollerRef {
  goToRandomSong: () => LocalSong | null;
}

interface VisibleItem {
  item: LocalSong;
  position: number;
}

const ITEM_WIDTH_CQW = 0.12;
const MAX_SCALE = 1.3;
const OVERSCAN = 3;

const mod = (n: number, m: number) => ((n % m) + m) % m;

interface SongScrollerProps {
  ref?: Ref<SongScrollerRef>;
  items: LocalSong[];
  sort: SortOption;
  searchQuery: string;
  searchFilter: SearchFilter;
  initialSong?: LocalSong;
  children: (item: LocalSong, index: number, scale: Accessor<number>) => JSX.Element;
  onCenteredItemChange?: (item: LocalSong | null, index: number) => void;
  onFilteredCountChange?: (count: number) => void;
  onScrollingChange?: (isScrolling: boolean) => void;
  class?: string;
}

export function SongScroller(props: SongScrollerProps) {
  let containerRef!: HTMLDivElement;

  const [offset, setOffset] = createSignal(0);
  const [containerWidth, setContainerWidth] = createSignal(0);
  const [currentItemId, setCurrentItemId] = createSignal<string | null>(null);
  const [hasInitialized, setHasInitialized] = createSignal(false);

  const itemWidth = () => containerWidth() * ITEM_WIDTH_CQW;

  const { filteredItems: filteredAndSortedItems } = useSongFilter({
    items: () => props.items,
    sort: () => props.sort,
    searchQuery: () => props.searchQuery,
    searchFilter: () => props.searchFilter,
  });

  createEffect(() => {
    props.onFilteredCountChange?.(filteredAndSortedItems().length);
  });

  const currentPosition = createMemo(() => {
    const width = itemWidth();
    return width === 0 ? 0 : Math.round(offset() / width);
  });

  const centeredIndex = createMemo(() => {
    const length = filteredAndSortedItems().length;
    if (length === 0) return 0;
    return mod(currentPosition(), length);
  });

  createEffect(
    on(
      () => [props.initialSong, filteredAndSortedItems()] as const,
      ([initialSong, items]) => {
        if (hasInitialized() || !initialSong || items.length === 0) return;

        const index = items.findIndex((item) => item.hash === initialSong.hash);
        if (index !== -1) {
          setOffset(index * itemWidth());
          setCurrentItemId(initialSong.hash);
          setHasInitialized(true);
        }
      },
    ),
  );

  createEffect(
    on(filteredAndSortedItems, (items) => {
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
          setCurrentItemId(firstSong.hash);
          setOffset(0);
          props.onCenteredItemChange?.(firstSong, 0);
        }
        return;
      }

      const newSongIndex = items.findIndex((item) => item.hash === id);
      if (newSongIndex === -1) {
        const firstSong = items[0];
        if (firstSong) {
          setCurrentItemId(firstSong.hash);
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
      const items = filteredAndSortedItems();
      const item = items[index];
      if (item) {
        setCurrentItemId(item.hash);
        props.onCenteredItemChange?.(item, index);
      }
    }),
  );

  const visibleRange = createMemo(() => {
    const width = itemWidth();
    if (width === 0) return { start: 0, end: 0 };

    const centerPos = currentPosition();
    const range = Math.ceil(containerWidth() / 2 / width) + OVERSCAN;
    return { start: centerPos - range, end: centerPos + range };
  });

  const visibleItems = createMemo(() => {
    const items = filteredAndSortedItems();
    const length = items.length;
    if (length === 0) return [];

    const { start, end } = visibleRange();
    const result: VisibleItem[] = [];
    for (let position = start; position <= end; position++) {
      const songIndex = mod(position, length);
      // biome-ignore lint/style/noNonNullAssertion: songIndex is always valid due to mod
      result.push({ item: items[songIndex]!, position });
    }
    return result;
  });

  const itemTransforms = createMemo(() => {
    const width = itemWidth();
    const containerW = containerWidth();
    const currentOffset = offset();
    const visible = visibleItems();

    if (width === 0 || visible.length === 0) return new Map<number, { x: number; scale: number }>();

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

    const result = new Map<number, { x: number; scale: number }>();
    for (const { position, distance, scale } of itemData) {
      let neighborOffset = 0;

      for (const scaled of scaledItems) {
        if (scaled.distance === distance) continue;
        if (distance > 0 && scaled.distance < distance) neighborOffset += scaled.extra;
        else if (distance < 0 && scaled.distance > distance) neighborOffset -= scaled.extra;
      }

      const x = containerW / 2 - width / 2 + distance + neighborOffset;
      result.set(position, { x, scale });
    }

    return result;
  });

  let velocity = 0;
  let lastWheelTime = 0;
  let animationFrame: number | undefined;
  let snapTarget: number | null = null;
  let holdDirection = 0;
  let isScrolling = false;
  let mounted = true;

  const setScrolling = (scrolling: boolean) => {
    if (scrolling !== isScrolling) {
      isScrolling = scrolling;
      props.onScrollingChange?.(scrolling);
    }
  };

  const animate = () => {
    // Stop animation if component is unmounted
    if (!mounted) {
      animationFrame = undefined;
      return;
    }

    const width = itemWidth();
    if (width === 0) {
      animationFrame = undefined;
      return;
    }

    const targetPos = snapTarget ?? currentPosition();
    const target = targetPos * width;
    const distance = target - offset();

    if (snapTarget !== null) {
      if (Math.abs(distance) < 0.5) {
        setOffset(target);
        velocity = 0;
        snapTarget = null;
        animationFrame = undefined;
        setScrolling(false);
        return;
      }
      velocity = distance * 0.15;
    } else if (holdDirection !== 0) {
      const holdSpeed = itemWidth() * 0.13;
      velocity = holdDirection * holdSpeed;
      setScrolling(true);
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
        setScrolling(false);
      } else {
        const dampingFactor = Math.abs(velocity) < 5 ? 0.88 : 0.92;
        velocity *= dampingFactor;
        setScrolling(true);
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

    if (timeDelta > 150) {
      goToPosition(currentPosition() + (delta > 0 ? 1 : -1));
      velocity = delta > 0 ? 5 : -5;
      return;
    }

    snapTarget = null;
    velocity = timeDelta < 50 ? velocity + delta * 0.5 : delta;
    velocity = Math.max(-50, Math.min(50, velocity));
    startAnimation();
  };

  const goToRandomSong = (): LocalSong | null => {
    const items = filteredAndSortedItems();
    if (items.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * items.length);
    const randomSong = items[randomIndex];
    if (!randomSong) return null;

    setOffset(randomIndex * itemWidth());
    setCurrentItemId(randomSong.hash);

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

  return (
    <div ref={containerRef} class={`relative overflow-hidden ${props.class ?? ""}`}>
      <For each={visibleItems()}>
        {({ item, position }) => {
          const t = () => itemTransforms().get(position) ?? { x: 0, scale: 1 };
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
