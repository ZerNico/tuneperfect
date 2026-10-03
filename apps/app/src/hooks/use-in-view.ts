import { type Accessor, createSignal, onCleanup, onMount } from "solid-js";

/**
 * Becomes true once the element has stayed near the viewport for `delay` ms, and then stays true.
 * The delay skips elements that only fly past (fast scrolling through a long list).
 */
export function useInView(
  element: Accessor<HTMLElement | undefined>,
  { rootMargin = "200px", delay = 0 }: { rootMargin?: string; delay?: number } = {},
): Accessor<boolean> {
  const [inView, setInView] = createSignal(false);

  onMount(() => {
    const target = element();
    if (!target) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting);
        clearTimeout(timer);
        if (!visible) return;
        timer = setTimeout(() => {
          setInView(true);
          observer.disconnect();
        }, delay);
      },
      { rootMargin },
    );
    observer.observe(target);
    onCleanup(() => {
      clearTimeout(timer);
      observer.disconnect();
    });
  });

  return inView;
}
