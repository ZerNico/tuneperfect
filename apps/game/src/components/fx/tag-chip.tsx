import { type JSX, Show } from "solid-js";

interface TagChipProps {
  label: JSX.Element;
  /** Optional coloured segment after the label. */
  accent?: JSX.Element;
  accentColor?: string;
  class?: string;
  classList?: Record<string, boolean | undefined>;
}

/** Boxed label chip, e.g. "COMBO | 25": dark text on white, then an optional coloured segment. */
export default function TagChip(props: TagChipProps) {
  return (
    <div
      classList={props.classList}
      class={`inline-flex items-stretch overflow-hidden rounded-[0.3em] leading-tight font-black tracking-wide uppercase ${props.class ?? ""}`}
    >
      <span class="flex items-center bg-white px-[0.5em] py-[0.12em] text-slate-900">{props.label}</span>
      <Show when={props.accent}>
        <span
          class="flex items-center px-[0.5em] py-[0.12em] text-white"
          style={{ "background-color": props.accentColor ?? "var(--color-pink-500)" }}
        >
          {props.accent}
        </span>
      </Show>
    </div>
  );
}
