import { type JSX, type Ref, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";
import { twMerge } from "tailwind-merge";

const SKEW = {
  left: { 6: "-skew-x-6", 12: "-skew-x-12" },
  right: { 6: "skew-x-6", 12: "skew-x-12" },
} as const;

export interface SlantPanelProps {
  as?: "div" | "span" | "button";
  /** Slant in degrees. */
  skew?: 6 | 12;
  /** "left" leans like `-skew-x-*` (the default), "right" like `skew-x-*`. */
  lean?: "left" | "right";
  /** Classes for the panel itself: layout, padding, text. Its content is never skewed. */
  class?: string;
  classList?: Record<string, boolean | undefined>;
  style?: JSX.CSSProperties;
  /** Classes for the slanted surface behind the content: background, ring, shadow, rounding. */
  surface?: string;
  surfaceClassList?: Record<string, boolean | undefined>;
  surfaceStyle?: JSX.CSSProperties;
  /** Drawn inside the slanted surface (and clipped by it, with `overflow-hidden`), e.g. fills or gradient layers. */
  surfaceContent?: JSX.Element;
  ref?: Ref<HTMLElement>;
  type?: "button" | "submit";
  disabled?: boolean;
  title?: string;
  "aria-label"?: string;
  onClick?: (event: MouseEvent) => void;
  onMouseEnter?: (event: MouseEvent) => void;
  onMouseLeave?: (event: MouseEvent) => void;
  onPointerDown?: (event: PointerEvent) => void;
  children?: JSX.Element;
}

/**
 * A slanted "sticker" surface. Only the layer behind the content is skewed, so the content
 * stays upright without counter-skewing, and the panel itself can be scaled, animated or
 * transformed freely (a `transform` on a skewed element would replace its skew).
 */
export default function SlantPanel(props: SlantPanelProps) {
  const [local, rest] = splitProps(props, [
    "as",
    "skew",
    "lean",
    "class",
    "surface",
    "surfaceClassList",
    "surfaceStyle",
    "surfaceContent",
    "ref",
    "children",
  ]);

  return (
    <Dynamic
      component={local.as ?? "div"}
      // Solid hands component refs down as setter functions.
      ref={local.ref as ((el: HTMLElement) => void) | undefined}
      class={twMerge("relative isolate", local.class)}
      {...rest}
    >
      <span
        aria-hidden="true"
        class={twMerge(
          "pointer-events-none absolute inset-0 -z-10 block",
          SKEW[local.lean ?? "left"][local.skew ?? 6],
          local.surface,
        )}
        classList={local.surfaceClassList}
        style={local.surfaceStyle}
      >
        {local.surfaceContent}
      </span>
      {local.children}
    </Dynamic>
  );
}
