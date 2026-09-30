import { type JSX, type Ref, Show } from "solid-js";
import { twMerge } from "tailwind-merge";
import IconCaretRight from "~icons/ph/caret-right-fill";

import Panel from "./panel";

export interface PlateProps {
  selected?: boolean;
  /** Mode gradient class shown while selected, e.g. "gradient-settings". */
  gradient?: string;
  /** Pressed state (confirm held down). */
  pressed?: boolean;
  /** "sm" for compact rows inside popups and panels (no side marker). */
  size?: "md" | "sm";
  class?: string;
  /** Classes for the content wrapper. */
  contentClass?: string;
  as?: "div" | "button";
  ref?: Ref<HTMLElement>;
  children?: JSX.Element;
  onClick?: () => void;
  onMouseEnter?: () => void;
  disabled?: boolean;
}

/**
 * The surface behind every interactive row and button: a faint plate when idle, the mode
 * gradient with a ▶ marker and a soft glow of the gradient behind it when selected.
 * Lists that draw one glow behind all their rows (see `Menu`) hide the per-plate glow
 * through its `plate-glow` class.
 */
export default function Plate(props: PlateProps) {
  const rounding = () => (props.size === "sm" ? "rounded-[0.6cqw]" : "rounded-[0.8cqw]");

  return (
    <Panel
      as={props.as}
      ref={props.ref}
      type={props.as === "button" ? "button" : undefined}
      disabled={props.disabled}
      onClick={() => props.onClick?.()}
      onMouseEnter={() => props.onMouseEnter?.()}
      class={twMerge(
        "shrink-0 cursor-pointer text-left transition-[scale] duration-150 ease-out",
        props.size === "sm" ? "h-11 text-sm" : "h-16",
        // Mouse press; a held confirm key presses via `pressed`.
        props.as === "button" && "active:scale-95",
        props.class,
      )}
      classList={{ "scale-[1.015]": props.selected && !props.pressed, "scale-95": props.pressed }}
      surface={`${rounding()} bg-white/6`}
      surfaceContent={
        <span
          class={`absolute inset-0 ${rounding()} bg-linear-to-r transition-opacity duration-150 ${props.gradient ?? "gradient-settings"}`}
          classList={{ "opacity-0": !props.selected }}
        />
      }
    >
      <span
        aria-hidden="true"
        class={`plate-glow pointer-events-none absolute inset-x-[4%] top-[25%] -bottom-[15%] -z-20 bg-linear-to-r opacity-0 blur-[1.2cqw] transition-opacity duration-200 ${props.gradient ?? "gradient-settings"}`}
        classList={{ "opacity-45": props.selected }}
      />
      <Show when={props.selected && props.size !== "sm"}>
        <div class="absolute top-1/2 -left-8 -translate-y-1/2">
          <IconCaretRight class="animate-pop-in text-2xl drop-shadow-md" />
        </div>
      </Show>
      <div class={twMerge("relative h-full", props.contentClass)}>{props.children}</div>
    </Panel>
  );
}
