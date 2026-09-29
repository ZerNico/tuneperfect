import { type Component, type JSX, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { twMerge } from "tailwind-merge";

interface ChipButtonProps {
  icon?: Component<{ class?: string }>;
  children?: JSX.Element;
  /** Trailing key glyph, e.g. `<KeyGlyph … />`. */
  hint?: JSX.Element;
  /** Leading key glyph. */
  leadingHint?: JSX.Element;
  onClick?: () => void;
  class?: string;
  label?: string;
  /** Render as static text instead of a button. */
  static?: boolean;
}

/** Slanted glass chip for toolbars: search, filters, counts, menus. */
export default function ChipButton(props: ChipButtonProps) {
  return (
    <Dynamic
      component={props.static ? "div" : "button"}
      type={props.static ? undefined : "button"}
      aria-label={props.label}
      onClick={() => props.onClick?.()}
      class={twMerge(
        "inline-flex h-10 shrink-0 -skew-x-6 items-center rounded-md bg-black/30 ring-1 ring-white/15 backdrop-blur-md ring-inset",
        !props.static && "cursor-pointer transition-all hover:bg-black/45 active:scale-95",
        props.class,
      )}
    >
      <span class="flex min-w-0 grow skew-x-6 items-center gap-2 px-3 text-sm font-bold">
        <Show when={props.leadingHint}>
          <span class="flex shrink-0 text-xs opacity-70">{props.leadingHint}</span>
        </Show>
        <Show when={props.icon}>{(icon) => <Dynamic component={icon()} class="shrink-0 text-lg" />}</Show>
        {props.children}
        <Show when={props.hint}>
          <span class="ml-1 flex shrink-0 text-xs opacity-70">{props.hint}</span>
        </Show>
      </span>
    </Dynamic>
  );
}
