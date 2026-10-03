import type { JSX } from "solid-js";

interface TagProps {
  children: JSX.Element;
  class?: string;
}

/** White boxed label, like the game's title chips: lobby codes, counts, "You". */
export default function Tag(props: TagProps) {
  return (
    <span
      class={`inline-flex shrink-0 rounded-[5px] bg-white px-[0.5em] py-[0.4em] font-black tracking-wide whitespace-nowrap text-slate-900 uppercase text-box-cap ${props.class ?? ""}`}
    >
      {props.children}
    </span>
  );
}
