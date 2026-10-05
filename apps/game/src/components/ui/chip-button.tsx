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

/** Rounded glass chip for toolbars: search, filters, counts, menus. */
export default function ChipButton(props: ChipButtonProps) {
  return (
    <Dynamic
      component={props.static ? "div" : "button"}
      type={props.static ? undefined : "button"}
      aria-label={props.label}
      onClick={() => props.onClick?.()}
      class={twMerge(
        "group inline-flex h-[2.6cqw] shrink-0 items-center rounded-[0.9cqw] bg-black/25 ring-1 ring-white/10 backdrop-blur-md ring-inset",
        !props.static && "cursor-pointer transition-[scale,background-color] hover:bg-black/40 active:scale-95",
        props.class,
      )}
    >
      <span class="flex min-w-0 grow items-center gap-[0.6cqw] px-[1.1cqw] text-[1cqw] font-bold">
        <Show when={props.leadingHint}>
          <span class="flex shrink-0 text-[1.2cqw] opacity-90">{props.leadingHint}</span>
        </Show>
        <Show when={props.icon}>{(icon) => <Dynamic component={icon()} class="shrink-0 text-[1.2cqw]" />}</Show>
        {props.children}
        <Show when={props.hint}>
          <span class="ml-[0.2cqw] flex shrink-0 text-[1.2cqw] opacity-90">{props.hint}</span>
        </Show>
      </span>
    </Dynamic>
  );
}
