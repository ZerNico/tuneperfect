import { type Component, type JSX, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import { twMerge } from "tailwind-merge";

import SlantPanel from "./slant-panel";

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
    <SlantPanel
      as={props.static ? "div" : "button"}
      type={props.static ? undefined : "button"}
      aria-label={props.label}
      onClick={() => props.onClick?.()}
      class={twMerge(
        "group inline-flex h-10 shrink-0 items-center",
        !props.static && "cursor-pointer transition-[scale] active:scale-95",
        props.class,
      )}
      surface={twMerge(
        "rounded-md bg-black/30 ring-1 ring-white/15 backdrop-blur-md ring-inset",
        !props.static && "transition-colors group-hover:bg-black/45",
      )}
    >
      <span class="flex min-w-0 grow items-center gap-2 px-3 text-sm font-bold">
        <Show when={props.leadingHint}>
          <span class="flex shrink-0 text-xs opacity-70">{props.leadingHint}</span>
        </Show>
        <Show when={props.icon}>{(icon) => <Dynamic component={icon()} class="shrink-0 text-lg" />}</Show>
        {props.children}
        <Show when={props.hint}>
          <span class="ml-1 flex shrink-0 text-xs opacity-70">{props.hint}</span>
        </Show>
      </span>
    </SlantPanel>
  );
}
