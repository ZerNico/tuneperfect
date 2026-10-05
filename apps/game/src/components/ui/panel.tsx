import { type JSX, type Ref, splitProps } from "solid-js";
import { Dynamic } from "solid-js/web";
import { twMerge } from "tailwind-merge";

export interface PanelProps {
  as?: "div" | "span" | "button";
  /** Classes for the panel itself: layout, padding, text. */
  class?: string;
  classList?: Record<string, boolean | undefined>;
  style?: JSX.CSSProperties;
  /** Classes for the surface behind the content: background, ring, shadow, rounding. */
  surface?: string;
  surfaceClassList?: Record<string, boolean | undefined>;
  surfaceStyle?: JSX.CSSProperties;
  /** Drawn inside the surface (and clipped by it, with `overflow-hidden`), e.g. fills or gradient layers. */
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
 * A panel whose surface is its own layer behind the content. The surface can then carry
 * clipped fills and cross-fading gradients, while the panel itself stays free to scale or
 * animate, and content can overflow it (markers, stickers).
 */
export default function Panel(props: PanelProps) {
  const [local, rest] = splitProps(props, [
    "as",
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
        class={twMerge("pointer-events-none absolute inset-0 -z-10 block", local.surface)}
        classList={local.surfaceClassList}
        style={local.surfaceStyle}
      >
        {local.surfaceContent}
      </span>
      {local.children}
    </Dynamic>
  );
}
