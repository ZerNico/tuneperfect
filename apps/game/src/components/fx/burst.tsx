import { createMemo, For } from "solid-js";

import { effectsEnabled, randomBetween } from "~/lib/fx";

const MAX_PARTICLES = 16;

// Four-point sparkle, like the stars in the golden notes.
const STAR_CLIP_PATH = "polygon(50% 0, 61% 39%, 100% 50%, 61% 61%, 50% 100%, 39% 61%, 0 50%, 39% 39%)";

interface BurstProps {
  /** Changing this value fires a new burst. Nothing renders while it is undefined. */
  trigger: number | undefined;
  color: string;
  count?: number;
  /** Maximum travel distance in cqw. */
  spread?: number;
  /** Particle size in cqw. */
  size?: number;
  shape?: "dot" | "star";
  class?: string;
}

/**
 * Radial particle burst from its own position. Place it inside a relatively
 * positioned parent; it takes up no space.
 */
export default function Burst(props: BurstProps) {
  const particles = createMemo(() => {
    const trigger = props.trigger;
    if (trigger === undefined || !effectsEnabled()) {
      return [];
    }

    const count = Math.min(props.count ?? 10, MAX_PARTICLES);
    const spread = props.spread ?? 3;
    const size = props.size ?? 0.5;

    return Array.from({ length: count }, (_, index) => {
      const angle = (index / count) * Math.PI * 2 + randomBetween(-0.3, 0.3);
      const distance = spread * randomBetween(0.5, 1);
      const particleSize = size * randomBetween(0.6, 1.2);

      return {
        trigger,
        size: particleSize,
        dx: Math.cos(angle) * distance,
        dy: Math.sin(angle) * distance,
        rotate: randomBetween(-180, 180),
        delay: randomBetween(0, 60),
      };
    });
  });

  return (
    <div class={`pointer-events-none absolute h-0 w-0 ${props.class ?? ""}`} aria-hidden="true">
      <For each={particles()}>
        {(particle) => (
          <div
            class="absolute animate-burst"
            classList={{ "rounded-full": props.shape !== "star" }}
            style={{
              width: `${particle.size}cqw`,
              height: `${particle.size}cqw`,
              "margin-left": `${-particle.size / 2}cqw`,
              "margin-top": `${-particle.size / 2}cqw`,
              "background-color": props.color,
              "box-shadow": props.shape === "star" ? undefined : `0 0 ${particle.size}cqw ${props.color}`,
              "clip-path": props.shape === "star" ? STAR_CLIP_PATH : undefined,
              "--dx": `${particle.dx}cqw`,
              "--dy": `${particle.dy}cqw`,
              "--rot": `${particle.rotate}deg`,
              "animation-delay": `${particle.delay}ms`,
            }}
          />
        )}
      </For>
    </div>
  );
}
