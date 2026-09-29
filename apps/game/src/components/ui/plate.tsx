import { type JSX, type Ref, Show, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";
import { twMerge } from "tailwind-merge";
import IconCaretRight from "~icons/ph/caret-right-fill";

export interface PlateProps {
  selected?: boolean;
  /** Mode gradient class shown while selected, e.g. "gradient-settings". */
  gradient?: string;
  /** Pressed state (confirm held down). */
  pressed?: boolean;
  /** "sm" for compact rows inside popups and panels (no side marker). */
  size?: "md" | "sm";
  class?: string;
  /** Classes for the counter-skewed content wrapper. */
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
 * marker when selected. Content is counter-skewed so text stays upright.
 */
export default function Plate(props: PlateProps) {
  const [local] = splitProps(props, ["as", "ref", "onClick", "onMouseEnter", "disabled"]);

  return (
    <Dynamic
      component={local.as ?? "div"}
      // Solid hands component refs down as setter functions.
      ref={local.ref as ((el: HTMLElement) => void) | undefined}
      type={local.as === "button" ? "button" : undefined}
      disabled={local.disabled}
      onClick={() => local.onClick?.()}
      onMouseEnter={() => local.onMouseEnter?.()}
      class={twMerge(
        "relative shrink-0 -skew-x-6 cursor-pointer rounded-lg text-left transition-[transform,box-shadow] duration-150 ease-out",
        props.size === "sm" ? "h-11 rounded-md text-sm" : "h-16",
        props.class,
      )}
      classList={{
        "scale-[1.015] shadow-[0.35cqw_0.35cqw_0_rgb(0_0_0/0.35)]": props.selected && !props.pressed,
        "scale-95": props.pressed,
      }}
    >
      <div class="absolute inset-0 rounded-lg bg-white/6 ring-1 ring-white/10 ring-inset" />
      <div
        class={`absolute inset-0 rounded-lg bg-linear-to-r transition-opacity duration-150 ${props.gradient ?? "gradient-settings"}`}
        classList={{ "opacity-0": !props.selected }}
      />
      <Show when={props.selected && props.size !== "sm"}>
        <div class="absolute top-1/2 -left-8 -translate-y-1/2 skew-x-6">
          <IconCaretRight class="animate-pop-in text-2xl drop-shadow-md" />
        </div>
      </Show>
      <div class={twMerge("relative h-full skew-x-6", props.contentClass)}>{props.children}</div>
    </Dynamic>
  );
}
