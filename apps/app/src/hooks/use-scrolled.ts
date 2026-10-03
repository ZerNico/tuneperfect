import { type Accessor, createSignal, onCleanup, onMount } from "solid-js";

/** True once the page is scrolled away from the top: the header and sticky bars get their backdrop then. */
export function useScrolled(threshold = 8): Accessor<boolean> {
  const [scrolled, setScrolled] = createSignal(false);

  onMount(() => {
    const update = () => setScrolled(window.scrollY > threshold);
    update();
    window.addEventListener("scroll", update, { passive: true });
    onCleanup(() => window.removeEventListener("scroll", update));
  });

  return scrolled;
}
