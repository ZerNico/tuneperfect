import { type JSX, Show } from "solid-js";

import { effectsEnabled } from "~/lib/fx";

interface SlamTextProps {
  /** Changing this value replays the slam animation. */
  trigger: unknown;
  class?: string;
  style?: JSX.CSSProperties;
  children: JSX.Element;
}

/** Content that slams in (big and blurred, then overshoots) whenever `trigger` changes. */
export default function SlamText(props: SlamTextProps) {
  return (
    <Show when={{ trigger: props.trigger }} keyed>
      {(_) => (
        <span
          class={`inline-block ${props.class ?? ""}`}
          classList={{ "animate-slam": effectsEnabled() }}
          style={props.style}
        >
          {props.children}
        </span>
      )}
    </Show>
  );
}
