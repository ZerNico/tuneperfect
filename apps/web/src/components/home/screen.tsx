import { type JSX, Show } from "solid-js";

/** Game screenshots, captured from the game with demo data. */
export const SHOTS = {
  singGroup: "/images/shots/sing-group.webp",
  select: "/images/shots/select.webp",
};

/**
 * A rounded game screen with the crisp drop: a screenshot, or live children (sized in `cqw`, so a recreation scales
 * like the real screen).
 */
export default function Screen(props: { src?: string; alt?: string; class?: string; children?: JSX.Element }) {
  return (
    <div
      class={`[container-type:inline-size] relative aspect-video overflow-hidden rounded-[16px] bg-[#14142e] ring-1 shadow-crisp ring-white/10 ${props.class ?? ""}`}
    >
      <Show when={props.src}>
        <img src={props.src} alt={props.alt} loading="lazy" decoding="async" class="size-full object-cover" />
      </Show>
      {props.children}
    </div>
  );
}
