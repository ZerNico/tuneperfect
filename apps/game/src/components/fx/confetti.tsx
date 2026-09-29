import { createMemo, For } from "solid-js";

import { effectsEnabled, randomBetween } from "~/lib/fx";

const MAX_PIECES = 60;

interface ConfettiProps {
  /** Changing this value drops a new batch. Nothing renders while it is undefined. */
  trigger: number | undefined;
  colors: string[];
  count?: number;
  class?: string;
}

/** Confetti falling across the parent. The parent should be relative and clip overflow. */
export default function Confetti(props: ConfettiProps) {
  const pieces = createMemo(() => {
    const trigger = props.trigger;
    const colors = props.colors;
    if (trigger === undefined || !effectsEnabled() || colors.length === 0) {
      return [];
    }

    const count = Math.min(props.count ?? 40, MAX_PIECES);

    return Array.from({ length: count }, (_, index) => ({
      trigger,
      left: randomBetween(0, 100),
      width: randomBetween(0.3, 0.6),
      height: randomBetween(0.6, 1.1),
      color: colors[index % colors.length],
      drift: randomBetween(-8, 8),
      rotate: randomBetween(360, 1080) * (Math.random() < 0.5 ? -1 : 1),
      delay: randomBetween(0, 600),
      duration: randomBetween(1800, 3000),
    }));
  });

  return (
    <div class={`pointer-events-none absolute inset-0 overflow-hidden ${props.class ?? ""}`} aria-hidden="true">
      <For each={pieces()}>
        {(piece) => (
          <div
            class="absolute top-0 animate-confetti rounded-[0.1cqw]"
            style={{
              left: `${piece.left}%`,
              width: `${piece.width}cqw`,
              height: `${piece.height}cqw`,
              "background-color": piece.color,
              "--dx": `${piece.drift}cqw`,
              "--rot": `${piece.rotate}deg`,
              "animation-delay": `${piece.delay}ms`,
              "animation-duration": `${piece.duration}ms`,
            }}
          />
        )}
      </For>
    </div>
  );
}
