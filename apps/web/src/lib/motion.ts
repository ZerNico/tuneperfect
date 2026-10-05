import { type Accessor, createSignal, onCleanup, onMount } from "solid-js";

export const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));
export const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;
export const easeOutQuart = (x: number) => 1 - (1 - x) ** 4;

export function prefersReducedMotion() {
  return matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Whether the element is (nearly) on screen; false during SSR and until mounted. */
export function useInView(element: Accessor<Element | undefined>, rootMargin = "100px") {
  const [inView, setInView] = createSignal(false);
  onMount(() => {
    const target = element();
    if (!target) return;
    const observer = new IntersectionObserver(([entry]) => setInView(!!entry?.isIntersecting), { rootMargin });
    observer.observe(target);
    onCleanup(() => observer.disconnect());
  });
  return inView;
}

/**
 * Calls back every animation frame while `active` is true, with the time since the first active frame.
 * Sections pass their in-view state, so nothing animates off screen.
 */
export function useFrame(callback: (elapsed: number, now: number) => void, active: Accessor<boolean> = () => true) {
  onMount(() => {
    let start: number | undefined;
    let frame = requestAnimationFrame(function loop(now) {
      if (active()) {
        start ??= now;
        callback(now - start, now);
      }
      frame = requestAnimationFrame(loop);
    });
    onCleanup(() => cancelAnimationFrame(frame));
  });
}
