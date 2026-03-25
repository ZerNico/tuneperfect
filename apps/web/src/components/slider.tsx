import { type Component, children, createSignal, For, type JSX, onCleanup, onMount } from "solid-js";
import IconChevronLeft from "~icons/lucide/chevron-left";
import IconChevronRight from "~icons/lucide/chevron-right";

import { cn } from "~/lib/utils/cn";

interface SliderProps {
  class?: string;
  children: JSX.Element;
  autoScroll?: number;
}

const Slider: Component<SliderProps> = (props) => {
  const [currentIndex, setCurrentIndex] = createSignal(0);
  let sliderRef: HTMLDivElement | undefined;
  let autoScrollTimer: number | undefined;
  const slides = children(() => props.children).toArray();

  const scrollToSlide = (index: number) => {
    if (!sliderRef) return;
    const slideWidth = sliderRef.clientWidth;
    sliderRef.scrollTo({
      left: slideWidth * index,
      behavior: "smooth",
    });
    setCurrentIndex(index);
  };

  const handleScroll = () => {
    if (!sliderRef) return;
    const slideWidth = sliderRef.clientWidth;
    const newIndex = Math.round(sliderRef.scrollLeft / slideWidth);
    if (newIndex !== currentIndex()) {
      setCurrentIndex(newIndex);
    }
  };

  const handlePrev = () => {
    const newIndex = Math.max(0, currentIndex() - 1);
    scrollToSlide(newIndex);
  };

  const handleNext = () => {
    const newIndex = Math.min(slides.length - 1, currentIndex() + 1);
    scrollToSlide(newIndex);
  };

  const startAutoScroll = () => {
    if (!props.autoScroll) return;
    autoScrollTimer = window.setInterval(() => {
      const nextIndex = sliderRef ? (Math.round(sliderRef.scrollLeft / sliderRef.clientWidth) + 1) % slides.length : 0;
      scrollToSlide(nextIndex);
    }, props.autoScroll);
  };

  const stopAutoScroll = () => {
    if (autoScrollTimer) {
      clearInterval(autoScrollTimer);
      autoScrollTimer = undefined;
    }
  };

  onMount(() => {
    if (sliderRef) {
      sliderRef.addEventListener("scroll", handleScroll);
      startAutoScroll();
    }
  });

  onCleanup(() => {
    stopAutoScroll();
  });

  return (
    <div class={cn("relative w-full", props.class)} onMouseEnter={stopAutoScroll} onMouseLeave={startAutoScroll}>
      <div ref={sliderRef} class="no-scrollbar flex w-full snap-x snap-mandatory overflow-x-auto">
        <For each={slides}>{(slide) => <div class="w-full flex-none snap-center">{slide}</div>}</For>
      </div>
      <button
        type="button"
        onClick={handlePrev}
        class="absolute top-1/2 left-4 -translate-y-1/2 cursor-pointer rounded-full bg-[#203141]/50 p-2 text-white backdrop-blur-sm transition-all hover:bg-[#203141]/75 max-md:hidden"
        disabled={currentIndex() === 0}
      >
        <IconChevronLeft class="-translate-x-0.25 text-xl" />
      </button>
      <button
        type="button"
        onClick={handleNext}
        class="absolute top-1/2 right-4 -translate-y-1/2 cursor-pointer rounded-full bg-[#203141]/50 p-2 text-white backdrop-blur-sm transition-all hover:bg-[#203141]/75 max-md:hidden"
        disabled={currentIndex() === slides.length - 1}
      >
        <IconChevronRight class="translate-x-0.25 text-xl" />
      </button>
      <div class="mt-4 flex justify-center gap-2">
        <For each={slides}>
          {(_, index) => (
            <button
              type="button"
              onClick={() => scrollToSlide(index())}
              class={cn("h-2 w-2 cursor-pointer rounded-full transition-all", {
                "w-4 bg-white": currentIndex() === index(),
                "bg-white/50 hover:bg-white/75": currentIndex() !== index(),
              })}
            />
          )}
        </For>
      </div>
    </div>
  );
};

export default Slider;
