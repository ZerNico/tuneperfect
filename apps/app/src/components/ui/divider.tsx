import type { JSX } from "solid-js";

/** A thin line with a label in the middle, e.g. "or" between two ways to do something. */
export default function Divider(props: { children: JSX.Element; class?: string }) {
  return (
    <div class={`flex items-center gap-3 text-sm text-white/45 ${props.class ?? ""}`}>
      <span class="h-px grow bg-white/15" />
      {props.children}
      <span class="h-px grow bg-white/15" />
    </div>
  );
}
