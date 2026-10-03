import type { JSX } from "solid-js";

interface CardProps {
  children: JSX.Element;
  class?: string;
}

export default function Card(props: CardProps) {
  return (
    <div
      class="rounded-[20px] bg-white/6 p-6 text-white"
      classList={{
        [props.class || ""]: true,
      }}
    >
      {props.children}
    </div>
  );
}
