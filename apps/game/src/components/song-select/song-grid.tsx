import { debounce, throttle } from "@solid-primitives/scheduled";
import { createVirtualizer } from "@tanstack/solid-virtual";
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, type Ref } from "solid-js";
import { useNavigation } from "~/hooks/navigation";
import { type SearchFilter, type SortOption, useSongFilter } from "~/hooks/use-song-filter";
import type { LocalSong } from "~/lib/ultrastar/song";
import { createRefContent } from "~/lib/utils/ref";

export type { SortOption, SearchFilter };

export interface SongGridRef {
  goToRandomSong: () => LocalSong | null;
}

const COLUMNS = 5;
const GAP = 12;
const PADDING = 16;
const VERTICAL_PADDING = 20;
const SCROLL_PADDING = 20;

interface SongGridProps {
  ref?: Ref<SongGridRef>;
  items: LocalSong[];
  sort: SortOption;
  searchQuery: string;
  searchFilter: SearchFilter;
  initialSong?: LocalSong;
  onSelectedItemChange?: (item: LocalSong | null, index: number) => void;
  onFilteredCountChange?: (count: number) => void;
  onScrollingChange?: (isScrolling: boolean) => void;
  onConfirm?: (item: LocalSong) => void;
  class?: string;
}

export function SongGrid(props: SongGridProps) {
  let containerRef!: HTMLDivElement;

  const [selectedIndex, setSelectedIndex] = createSignal(0);
  const [selectedHash, setSelectedHash] = createSignal<string | null>(null);
  const [hasInitialized, setHasInitialized] = createSignal(false);
  const [rowHeight, setRowHeight] = createSignal(120);

  const { filteredItems } = useSongFilter({
    items: () => props.items,
    sort: () => props.sort,
    searchQuery: () => props.searchQuery,
    searchFilter: () => props.searchFilter,
  });

  const rowCount = createMemo(() => Math.ceil(filteredItems().length / COLUMNS));

  const rows = createMemo(() => {
    const items = filteredItems();
    const result: LocalSong[][] = [];
    for (let i = 0; i < items.length; i += COLUMNS) {
      result.push(items.slice(i, i + COLUMNS));
    }
    return result;
  });

  const virtualizer = createVirtualizer({
    get count() {
      return rowCount();
    },
    getScrollElement: () => containerRef,
    estimateSize: () => rowHeight(),
    overscan: 3,
  });

  onMount(() => {
    const measureRowHeight = () => {
      if (!containerRef) return;
      const containerWidth = containerRef.clientWidth;
      const cardWidth = (containerWidth - PADDING * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
      setRowHeight(cardWidth + GAP);
      virtualizer.measure();
    };

    measureRowHeight();

    const resizeObserver = new ResizeObserver(measureRowHeight);
    resizeObserver.observe(containerRef);

    onCleanup(() => resizeObserver.disconnect());
  });

  createEffect(() => {
    props.onFilteredCountChange?.(filteredItems().length);
  });

  createEffect(
    on(
      () => [props.initialSong, filteredItems()] as const,
      ([initialSong, items]) => {
        if (hasInitialized() || items.length === 0) return;

        // If we have an initial song, find it and scroll to it
        if (initialSong) {
          const index = items.findIndex((item) => item.hash === initialSong.hash);
          if (index !== -1) {
            setSelectedIndex(index);
            setSelectedHash(initialSong.hash);
            setHasInitialized(true);
            props.onSelectedItemChange?.(initialSong, index);
            const rowIndex = Math.floor(index / COLUMNS);
            virtualizer.scrollToIndex(rowIndex, { align: "center" });
            return;
          }
        }

        // No initial song or not found - default to first item
        const firstSong = items[0];
        if (firstSong) {
          setSelectedIndex(0);
          setSelectedHash(firstSong.hash);
          setHasInitialized(true);
          props.onSelectedItemChange?.(firstSong, 0);
        }
      },
    ),
  );

  createEffect(
    on(filteredItems, (items) => {
      // Skip if not initialized yet - let the initialization effect handle it
      if (!hasInitialized()) return;

      if (items.length === 0) {
        props.onSelectedItemChange?.(null, -1);
        return;
      }

      const currentHash = selectedHash();

      if (currentHash) {
        const newIndex = items.findIndex((item) => item.hash === currentHash);
        if (newIndex !== -1) {
          setSelectedIndex(newIndex);
          scrollToIndex(newIndex, false);
          props.onSelectedItemChange?.(items[newIndex]!, newIndex);
          return;
        }
      }

      setSelectedIndex(0);
      const firstSong = items[0];
      if (firstSong) {
        setSelectedHash(firstSong.hash);
        props.onSelectedItemChange?.(firstSong, 0);
      }
    }),
  );

  createEffect(
    on(selectedIndex, (index) => {
      // Skip if not initialized yet - let the initialization effect handle first selection
      if (!hasInitialized()) return;

      const items = filteredItems();
      const item = items[index];
      if (item) {
        setSelectedHash(item.hash);
        props.onSelectedItemChange?.(item, index);
      }
    }),
  );

  const scrollToIndex = (index: number, smooth = true) => {
    const rowIndex = Math.floor(index / COLUMNS);
    const scrollEl = containerRef;
    if (!scrollEl) return;

    const rowStart = rowIndex * rowHeight() + VERTICAL_PADDING;
    const rowEnd = rowStart + rowHeight();
    const viewportTop = scrollEl.scrollTop;
    const viewportBottom = viewportTop + scrollEl.clientHeight;

    let newScrollTop: number | null = null;

    if (rowStart < viewportTop + SCROLL_PADDING) {
      newScrollTop = rowStart - SCROLL_PADDING;
    } else if (rowEnd > viewportBottom - SCROLL_PADDING) {
      newScrollTop = rowEnd - scrollEl.clientHeight + SCROLL_PADDING;
    }

    if (newScrollTop !== null) {
      scrollEl.scrollTo({
        top: Math.max(0, newScrollTop),
        behavior: smooth ? "smooth" : "auto",
      });
    }
  };

  const navigate = (direction: "up" | "down" | "left" | "right") => {
    const items = filteredItems();
    if (items.length === 0) return;

    const current = selectedIndex();
    let newIndex = current;

    switch (direction) {
      case "left":
        if (current % COLUMNS > 0) newIndex = current - 1;
        break;
      case "right":
        if (current % COLUMNS < COLUMNS - 1 && current + 1 < items.length) newIndex = current + 1;
        break;
      case "up":
        if (current >= COLUMNS) newIndex = current - COLUMNS;
        break;
      case "down":
        if (current + COLUMNS < items.length) newIndex = current + COLUMNS;
        break;
    }

    if (newIndex !== current) {
      setSelectedIndex(newIndex);
      scrollToIndex(newIndex);
    }
  };

  const goToRandomSong = (): LocalSong | null => {
    const items = filteredItems();
    if (items.length === 0) return null;

    const randomIndex = Math.floor(Math.random() * items.length);
    const randomSong = items[randomIndex];
    if (!randomSong) return null;

    setSelectedIndex(randomIndex);
    scrollToIndex(randomIndex, false);

    return randomSong;
  };

  createRefContent(
    () => props.ref,
    () => ({ goToRandomSong }),
  );

  const setScrollingFalse = debounce(() => props.onScrollingChange?.(false), 200);
  const throttledNavigate = throttle(navigate, 100);

  useNavigation({
    onKeydown: (event) => {
      if (event.action === "left") navigate("left");
      else if (event.action === "right") navigate("right");
      else if (event.action === "up") navigate("up");
      else if (event.action === "down") navigate("down");
    },
    onRepeat: (event) => {
      props.onScrollingChange?.(true);
      setScrollingFalse();
      if (event.action === "left") throttledNavigate("left");
      else if (event.action === "right") throttledNavigate("right");
      else if (event.action === "up") throttledNavigate("up");
      else if (event.action === "down") throttledNavigate("down");
    },
  });

  const handleMouseEnter = (index: number) => setSelectedIndex(index);
  const handleClick = (song: LocalSong) => props.onConfirm?.(song);

  return (
    <div ref={containerRef} class={`styled-scrollbars overflow-y-auto ${props.class ?? ""}`}>
      <div class="relative w-full" style={{ height: `${virtualizer.getTotalSize() + VERTICAL_PADDING * 2}px` }}>
        <For each={virtualizer.getVirtualItems()}>
          {(virtualRow) => {
            const rowItems = () => rows()[virtualRow.index] ?? [];
            const baseIndex = () => virtualRow.index * COLUMNS;

            return (
              <div
                class="absolute left-0 top-0 grid w-full grid-cols-5 gap-3 px-4"
                style={{ transform: `translateY(${virtualRow.start + VERTICAL_PADDING}px)` }}
              >
                <For each={rowItems()}>
                  {(song, colIndex) => {
                    const itemIndex = () => baseIndex() + colIndex();
                    return (
                      <div
                        onMouseEnter={() => handleMouseEnter(itemIndex())}
                        onClick={() => handleClick(song)}
                        onKeyDown={(e) => e.key === "Enter" && handleClick(song)}
                      >
                        <SongGridCard song={song} selected={selectedIndex() === itemIndex()} />
                      </div>
                    );
                  }}
                </For>
              </div>
            );
          }}
        </For>
      </div>
    </div>
  );
}

interface SongGridCardProps {
  song: LocalSong;
  selected?: boolean;
}

function SongGridCard(props: SongGridCardProps) {
  return (
    <div
      class="relative aspect-square w-full cursor-pointer overflow-hidden rounded-lg shadow-md transition-all duration-150 active:scale-95"
      classList={{ "ring-4 ring-white scale-105": props.selected }}
    >
      <img class="h-full w-full object-cover" src={props.song.coverUrl ?? ""} alt={props.song.title} />
      <div class="absolute inset-0 -z-1 bg-black" />
    </div>
  );
}
