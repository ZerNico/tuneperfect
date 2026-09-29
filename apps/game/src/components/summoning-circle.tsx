import { createUniqueId, For } from "solid-js";

import { effectsEnabled } from "~/lib/fx";

const STAR_CLIP_PATH = "polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%)";
const RING_TEXT = "TUNE PERFECT • SING • PARTY • PERFORM • ";
const PROGRESS_RADIUS = 58;
const PROGRESS_LENGTH = 2 * Math.PI * PROGRESS_RADIUS;

interface SummoningCircleProps {
  /** 0–100 */
  progress: number;
  class?: string;
}

/** Rotating rune rings around a progress arc, for loading screens. */
export default function SummoningCircle(props: SummoningCircleProps) {
  const textPathId = createUniqueId();
  const spin = (seconds: number, reverse = false) =>
    effectsEnabled()
      ? {
          animation: `spin ${seconds}s linear infinite${reverse ? " reverse" : ""}`,
          "transform-origin": "center",
        }
      : {};

  return (
    <div class={`relative aspect-square ${props.class ?? ""}`}>
      <svg viewBox="0 0 200 200" class="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
        <defs>
          <path id={textPathId} d="M 100 100 m -84 0 a 84 84 0 1 1 168 0 a 84 84 0 1 1 -168 0" />
        </defs>

        {/* Outer ring with rune text */}
        <g style={spin(60)}>
          <circle cx="100" cy="100" r="96" fill="none" stroke="white" stroke-opacity="0.35" stroke-width="0.6" />
          <circle cx="100" cy="100" r="76" fill="none" stroke="white" stroke-opacity="0.35" stroke-width="0.6" />
          <text fill="white" fill-opacity="0.6" font-size="7" font-weight="700" letter-spacing="2.2">
            <textPath href={`#${textPathId}`}>{RING_TEXT.repeat(2)}</textPath>
          </text>
        </g>

        {/* Tick marks */}
        <g style={spin(90, true)}>
          <For each={Array.from({ length: 48 }, (_, index) => index)}>
            {(index) => (
              <line
                x1="100"
                y1={index % 4 === 0 ? 20 : 22}
                x2="100"
                y2="26"
                stroke="white"
                stroke-opacity={index % 4 === 0 ? 0.7 : 0.3}
                stroke-width="0.8"
                transform={`rotate(${index * 7.5} 100 100)`}
              />
            )}
          </For>
        </g>

        {/* Two overlapping squares form an eight-point star */}
        <g style={spin(40, true)} fill="none" stroke="white" stroke-opacity="0.45" stroke-width="0.7">
          <rect x="55" y="55" width="90" height="90" />
          <rect x="55" y="55" width="90" height="90" transform="rotate(45 100 100)" />
        </g>

        {/* Progress arc, starting at the top */}
        <circle
          cx="100"
          cy="100"
          r={PROGRESS_RADIUS}
          fill="none"
          stroke="white"
          stroke-opacity="0.15"
          stroke-width="2.5"
        />
        <circle
          cx="100"
          cy="100"
          r={PROGRESS_RADIUS}
          fill="none"
          stroke="white"
          stroke-width="2.5"
          stroke-linecap="round"
          stroke-dasharray={`${PROGRESS_LENGTH}`}
          stroke-dashoffset={`${PROGRESS_LENGTH * (1 - Math.min(Math.max(props.progress, 0), 100) / 100)}`}
          transform="rotate(-90 100 100)"
          style={{ transition: "stroke-dashoffset 0.3s ease-out" }}
        />
      </svg>

      {/* Glowing star in the centre */}
      <div class="absolute inset-0 flex items-center justify-center">
        <div
          class="h-1/5 w-1/5 bg-white"
          classList={{ "animate-pulse-glow": effectsEnabled() }}
          style={{
            "clip-path": STAR_CLIP_PATH,
            filter: "drop-shadow(0 0 1cqw white)",
          }}
        />
      </div>
    </div>
  );
}
