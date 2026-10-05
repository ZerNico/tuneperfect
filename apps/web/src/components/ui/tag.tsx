import type { JSX } from "solid-js";

/** White boxed uppercase chip, like the game's title chips. */
export default function Tag(props: { children: JSX.Element; class?: string }) {
  return (
    <span
      class={`inline-flex h-6 items-center gap-1.5 rounded-[6px] px-2 text-xs font-bold tracking-wider uppercase text-box-cap ${props.class ?? "bg-white text-[#101024]"}`}
    >
      {props.children}
    </span>
  );
}
