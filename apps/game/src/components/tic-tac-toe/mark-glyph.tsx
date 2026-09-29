import { type JSX, Show } from "solid-js";

import { getColorVar } from "~/lib/utils/color";
import type { Mark } from "~/stores/party/tic-tac-toe";

interface MarkGlyphProps {
  mark: Mark;
  /** Team colour name, e.g. "sky". */
  color: string;
  class?: string;
  classList?: Record<string, boolean | undefined>;
  style?: JSX.CSSProperties;
}

/** Chunky sticker X or O: white outline, team-coloured core, hard offset shadow. */
export default function MarkGlyph(props: MarkGlyphProps) {
  const color = () => getColorVar(props.color, 400);

  return (
    <svg viewBox="0 0 100 100" class={props.class} classList={props.classList} style={props.style} aria-hidden="true">
      <g class="drop-shadow-[0.35cqw_0.35cqw_0_rgb(0_0_0/0.35)]">
        <Show
          when={props.mark === "x"}
          fallback={
            <>
              <circle cx="50" cy="50" r="31" fill="none" stroke="white" stroke-width="26" />
              <circle cx="50" cy="50" r="31" fill="none" stroke={color()} stroke-width="15" />
            </>
          }
        >
          <path d="M22 22 L78 78 M78 22 L22 78" stroke="white" stroke-width="30" stroke-linecap="round" />
          <path d="M22 22 L78 78 M78 22 L22 78" stroke={color()} stroke-width="18" stroke-linecap="round" />
        </Show>
      </g>
    </svg>
  );
}
