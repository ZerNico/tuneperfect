import { type JSX, Show } from "solid-js";

import SlantPanel from "../ui/slant-panel";

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
    // Each segment has its own slanted surface; with equal heights their shared edge lines up.
    <div
      classList={props.classList}
      class={`inline-flex items-stretch font-black tracking-wider uppercase ${props.class ?? ""}`}
    >
      <SlantPanel
        as="span"
        skew={12}
        class="flex items-center px-[0.6em] py-[0.15em] text-black"
        surface={`bg-white shadow-md ${props.accent ? "rounded-l-sm" : "rounded-sm"}`}
      >
        {props.label}
      </SlantPanel>
      <Show when={props.accent}>
        <SlantPanel
          as="span"
          skew={12}
          class="flex items-center px-[0.6em] py-[0.15em] text-white"
          surface="rounded-r-sm shadow-md"
          surfaceStyle={{ "background-color": props.accentColor ?? "var(--color-pink-500)" }}
        >
          {props.accent}
        </SlantPanel>
      </Show>
    </div>
  );
}
