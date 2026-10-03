import { type Accessor, createSignal, onCleanup, onMount } from "solid-js";

/** Becomes true once the element has scrolled near the viewport, and stays true. */
export function useInView(element: Accessor<HTMLElement | undefined>, rootMargin = "200px"): Accessor<boolean> {
  const [inView, setInView] = createSignal(false);

  onMount(() => {
    const target = element();
    if (!target) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(target);
    onCleanup(() => observer.disconnect());
  });

  return inView;
}
