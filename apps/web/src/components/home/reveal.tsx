import { createSignal, type JSX, onCleanup, onMount } from "solid-js";

import { prefersReducedMotion } from "~/lib/motion";

const EASE = "cubic-bezier(0.22,1,0.36,1)";

/**
 * Fades its content up once, the first time it scrolls into view. Content that is already on screen (or rendered
 * without JS) is never hidden.
 */
export default function Reveal(props: { children: JSX.Element; class?: string; delay?: number }) {
  let element: HTMLDivElement | undefined;
  const [state, setState] = createSignal<"idle" | "hidden" | "shown">("idle");

  onMount(() => {
    if (!element || prefersReducedMotion()) return;
    const reached = () => element!.getBoundingClientRect().top < window.innerHeight * 0.94;
    if (reached()) return;
    setState("hidden");

    const check = () => {
      if (!reached()) return;
      setState("shown");
      window.removeEventListener("scroll", check);
    };
    window.addEventListener("scroll", check, { passive: true });
    onCleanup(() => window.removeEventListener("scroll", check));
  });

  return (
    <div
      ref={element}
      class={props.class}
      classList={{ "translate-y-6 opacity-0": state() === "hidden" }}
      style={{
        transition: state() === "idle" ? undefined : `opacity 700ms ${EASE}, translate 700ms ${EASE}`,
        "transition-delay": state() === "shown" ? `${props.delay ?? 0}ms` : undefined,
      }}
    >
      {props.children}
    </div>
  );
}
