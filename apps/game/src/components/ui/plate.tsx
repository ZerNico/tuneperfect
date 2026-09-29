import { type JSX, type Ref, Show } from "solid-js";
import { twMerge } from "tailwind-merge";
import IconCaretRight from "~icons/ph/caret-right-fill";

import SlantPanel from "./slant-panel";

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
 * The slanted "sticker" surface behind every interactive row and button:
 * a faint plate when idle, the mode gradient with a hard offset shadow and a
 * marker when selected.
 */
export default function Plate(props: PlateProps) {
  const rounding = () => (props.size === "sm" ? "rounded-md" : "rounded-lg");

  return (
    <SlantPanel
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
      surface={`${rounding()} bg-white/6 ring-1 ring-white/10 ring-inset transition-shadow duration-150`}
      surfaceClassList={{ "shadow-[0.35cqw_0.35cqw_0_rgb(0_0_0/0.35)]": props.selected && !props.pressed }}
      surfaceContent={
        <span
          class={`absolute inset-0 ${rounding()} bg-linear-to-r transition-opacity duration-150 ${props.gradient ?? "gradient-settings"}`}
          classList={{ "opacity-0": !props.selected }}
        />
      }
    >
      <Show when={props.selected && props.size !== "sm"}>
        <div class="absolute top-1/2 -left-8 -translate-y-1/2">
          <IconCaretRight class="animate-pop-in text-2xl drop-shadow-md" />
        </div>
      </Show>
      <div class={twMerge("relative h-full", props.contentClass)}>{props.children}</div>
    </SlantPanel>
  );
}
