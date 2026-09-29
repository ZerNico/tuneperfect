import { type JSX, Show } from "solid-js";

interface TagChipProps {
  label: JSX.Element;
  /** Optional coloured segment after the label. */
  accent?: JSX.Element;
  accentColor?: string;
  class?: string;
  classList?: Record<string, boolean | undefined>;
}

/** Slanted label chip, e.g. "COMBO | 25". */
export default function TagChip(props: TagChipProps) {
  return (
    <div
      classList={props.classList}
      class={`inline-flex -skew-x-12 items-stretch overflow-hidden rounded-sm font-black tracking-wider uppercase shadow-md ${props.class ?? ""}`}
    >
      <span class="flex items-center bg-white px-[0.6em] py-[0.15em] text-black">
        <span class="skew-x-12">{props.label}</span>
      </span>
      <Show when={props.accent}>
        <span
          class="flex items-center px-[0.6em] py-[0.15em] text-white"
          style={{ "background-color": props.accentColor ?? "var(--color-pink-500)" }}
        >
          <span class="skew-x-12">{props.accent}</span>
        </span>
      </Show>
    </div>
  );
}
