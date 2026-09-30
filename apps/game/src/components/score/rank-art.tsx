import { For, Show } from "solid-js";

import type { TierId } from "~/lib/utils/score";

const INK = "#1b1b3a";

/** White sticker edge all around, then a soft shadow underneath. */
const STICKER_FILTER = [
  "drop-shadow(0.15cqw 0 0 white)",
  "drop-shadow(-0.15cqw 0 0 white)",
  "drop-shadow(0 0.15cqw 0 white)",
  "drop-shadow(0 -0.15cqw 0 white)",
  "drop-shadow(0 0.5cqw 0.8cqw rgb(0 0 0 / 0.35))",
].join(" ");

const shape = (fill: string) => ({ fill, stroke: INK, "stroke-width": 4, "stroke-linejoin": "round" as const });
const line = (color: string, width: number) => ({
  stroke: color,
  "stroke-width": width,
  "stroke-linecap": "round" as const,
});

/** Four-point sparkle centred on (x, y). */
const sparkle = (x: number, y: number, r: number) =>
  `M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z`;

/** Five-point star centred on (x, y). */
const star = (x: number, y: number, outer: number, inner: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const radius = i % 2 === 0 ? outer : inner;
    return `${i === 0 ? "M" : "L"}${(x + Math.cos(angle) * radius).toFixed(1)} ${(y + Math.sin(angle) * radius).toFixed(1)}`;
  }).join(" ") + "Z";

interface RankArtProps {
  tier: TierId;
  /** Play the rank's idle animation (drops falling, bulbs chasing, …). */
  animated?: boolean;
  class?: string;
}

/**
 * Sticker illustration for a result rank, drawn on a 120×120 canvas. Parts
 * carry `animate-art-*` classes for their animation, which only run when `animated`.
 */
export default function RankArt(props: RankArtProps) {
  // `art-part` makes SVG transforms pivot around each part's own centre.
  const anim = (name: string) => (props.animated ? `art-part ${name}` : undefined);
  const delay = (ms: number) => ({ "animation-delay": `${ms}ms` });

  return (
    <svg
      viewBox="0 0 120 120"
      class={`overflow-visible ${props.class ?? ""}`}
      style={{ filter: STICKER_FILTER }}
      aria-hidden="true"
    >
      <Show when={props.tier === "d"}>
        {/* Shower head with falling drops and rising bubbles */}
        <path d="M22 6 V40 Q22 52 34 52 H56" fill="none" {...line(INK, 14)} />
        <path d="M22 6 V40 Q22 52 34 52 H56" fill="none" {...line("#cbd5e1", 8)} />
        <path d="M50 64 L92 64 L84 48 Q71 38 58 48 Z" {...shape("#e2e8f0")} />
        <For each={[56, 65, 74, 83]}>
          {(x, i) => (
            <path
              d={`M${x} 72 L${x - 3} 84`}
              class={anim("animate-art-drop")}
              style={delay(i() * 170)}
              {...line("#38bdf8", 5)}
            />
          )}
        </For>
        <circle cx="30" cy="92" r="10" class={anim("animate-art-bubble")} {...shape("#e0f2fe")} />
        <circle cx="54" cy="104" r="6" class={anim("animate-art-bubble")} style={delay(400)} {...shape("#e0f2fe")} />
        <g class={anim("animate-art-bubble")} style={delay(800)}>
          <circle cx="90" cy="96" r="12" {...shape("#e0f2fe")} />
          <circle cx="86" cy="91" r="3" fill="white" />
        </g>
      </Show>

      <Show when={props.tier === "c"}>
        {/* A lone mic on a stand under a spotlight */}
        <path d="M52 0 L68 0 L106 120 L14 120 Z" fill="#fde047" opacity="0.22" class={anim("animate-art-flicker")} />
        <path d="M60 68 V104" {...line(INK, 8)} />
        <ellipse cx="60" cy="108" rx="24" ry="7" {...shape("#64748b")} />
        <rect x="52" y="54" width="16" height="20" rx="4" {...shape("#475569")} />
        <circle cx="60" cy="42" r="17" {...shape("#94a3b8")} />
        <path d="M48 36 H72 M46 44 H74 M49 52 H71" {...line(INK, 2.5)} />
      </Show>

      <Show when={props.tier === "b"}>
        {/* Shooting star with a shimmering rainbow trail */}
        <g class={anim("animate-art-shimmer")}>
          <path d="M8 112 Q40 86 66 56" fill="none" {...line("#a855f7", 14)} />
          <path d="M18 116 Q48 92 70 62" fill="none" {...line("#ec4899", 8)} />
          <path d="M4 102 Q34 78 62 52" fill="none" {...line("#38bdf8", 6)} />
        </g>
        <path d={star(80, 40, 28, 12)} class={anim("animate-art-twinkle")} {...shape("#facc15")} />
        <path d={sparkle(24, 30, 9)} class={anim("animate-art-flash")} style={delay(300)} {...shape("#ffffff")} />
        <path d={sparkle(104, 92, 7)} class={anim("animate-art-flash")} style={delay(900)} {...shape("#ffffff")} />
      </Show>

      <Show when={props.tier === "a"}>
        {/* Marquee sign with chasing light bulbs */}
        <path d="M34 90 V114 M86 90 V114" {...line(INK, 7)} />
        <rect x="10" y="22" width="100" height="70" rx="12" {...shape("#ec4899")} />
        <rect x="24" y="36" width="72" height="42" rx="6" {...shape("#fdf2f8")} />
        <text x="60" y="66" text-anchor="middle" font-size="22" font-weight="900" fill={INK}>
          LIVE
        </text>
        <For each={[18, 32, 46, 60, 74, 88, 102]}>
          {(x, i) => (
            <>
              <circle
                cx={x}
                cy="29"
                r="4.5"
                class={anim("animate-art-chase")}
                style={delay(i() * 110)}
                {...shape("#fde047")}
              />
              <circle
                cx={x}
                cy="85"
                r="4.5"
                class={anim("animate-art-chase")}
                style={delay((6 - i()) * 110)}
                {...shape("#fde047")}
              />
            </>
          )}
        </For>
      </Show>

      <Show when={props.tier === "s"}>
        {/* Star in sunglasses with camera flashes popping around it */}
        <path d={sparkle(18, 22, 13)} class={anim("animate-art-flash")} {...shape("#ffffff")} />
        <path d={sparkle(104, 18, 10)} class={anim("animate-art-flash")} style={delay(350)} {...shape("#ffffff")} />
        <path d={sparkle(106, 100, 12)} class={anim("animate-art-flash")} style={delay(700)} {...shape("#ffffff")} />
        <path d={sparkle(14, 96, 8)} class={anim("animate-art-flash")} style={delay(1050)} {...shape("#ffffff")} />
        <g class={anim("animate-art-twinkle")}>
          <path d={star(60, 66, 46, 21)} {...shape("#facc15")} />
          <path d="M38 58 H56 Q56 72 47 72 Q38 72 38 58 Z M64 58 H82 Q82 72 73 72 Q64 72 64 58 Z" {...shape(INK)} />
          <path d="M56 60 H64" {...line(INK, 4)} />
          <path d="M50 82 Q60 90 70 82" fill="none" {...line(INK, 4)} />
        </g>
      </Show>

      <Show when={props.tier === "splus"}>
        {/* Jewelled crown with fireworks bursting behind it */}
        <For
          each={[
            { x: 22, y: 26, color: "#f472b6", wait: 0 },
            { x: 98, y: 22, color: "#38bdf8", wait: 500 },
          ]}
        >
          {(burst) => (
            <g class={anim("animate-art-burst")} style={delay(burst.wait)}>
              <For each={[0, 45, 90, 135, 180, 225, 270, 315]}>
                {(angle) => {
                  const r = (angle * Math.PI) / 180;
                  return (
                    <path
                      d={`M${burst.x + Math.cos(r) * 7} ${burst.y + Math.sin(r) * 7} L${burst.x + Math.cos(r) * 17} ${burst.y + Math.sin(r) * 17}`}
                      {...line(burst.color, 4)}
                    />
                  );
                }}
              </For>
            </g>
          )}
        </For>
        <path d="M20 94 L26 46 L44 66 L60 36 L76 66 L94 46 L100 94 Z" {...shape("#facc15")} />
        <rect x="18" y="90" width="84" height="16" rx="4" {...shape("#f59e0b")} />
        <circle cx="26" cy="44" r="5" {...shape("#fde047")} />
        <circle cx="60" cy="33" r="6" {...shape("#fde047")} />
        <circle cx="94" cy="44" r="5" {...shape("#fde047")} />
        <circle cx="40" cy="98" r="4" class={anim("animate-art-glint")} {...shape("#ef4444")} />
        <circle cx="60" cy="98" r="4" class={anim("animate-art-glint")} style={delay(300)} {...shape("#3b82f6")} />
        <circle cx="80" cy="98" r="4" class={anim("animate-art-glint")} style={delay(600)} {...shape("#22c55e")} />
      </Show>
    </svg>
  );
}
