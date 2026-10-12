import type { JSX } from "@solidjs/web";

interface CardProps {
  children: JSX.Element;
  class?: string;
}

export default function Card(props: CardProps) {
  return <div class={["rounded-[20px] bg-white/6 p-6 text-white", props.class]}>{props.children}</div>;
}
