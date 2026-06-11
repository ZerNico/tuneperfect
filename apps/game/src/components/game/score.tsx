import { createEffect, createMemo, createSignal, on, onCleanup } from "solid-js";

import { useGame } from "~/lib/game/game-context";
import { usePlayer } from "~/lib/game/player-context";

const TWEEN_DURATION_MS = 250;
const POP_THRESHOLD = 500;

interface ScoreProps {
  class?: string;
  classList?: {
    [k: string]: boolean | undefined;
  };
}

export default function Score(props: ScoreProps) {
  const game = useGame();
  const player = usePlayer();

  const targetScore = createMemo(() => {
    const maxScore = player.maxScore();
    const currentScore = player.score();

    const maxScoreTotal = maxScore.normal + maxScore.golden + maxScore.bonus;
    const currentScoreTotal = currentScore.normal + currentScore.golden + currentScore.bonus;

    if (maxScoreTotal === 0) return 0;

    return Math.round((currentScoreTotal / maxScoreTotal) * 100000);
  });

  const [displayScore, setDisplayScore] = createSignal(0);
  const [pop, setPop] = createSignal(false);

  createEffect(
    on(targetScore, (target, previousTarget) => {
      const start = displayScore();
      if (target === start) {
        return;
      }

      // Pop when a meaningful amount of points lands at once.
      if (previousTarget !== undefined && target - previousTarget > POP_THRESHOLD) {
        setPop(false);
        requestAnimationFrame(() => setPop(true));
      }

      const startTime = performance.now();
      let animationFrame: number;

      const animate = (currentTime: number) => {
        const progress = Math.min((currentTime - startTime) / TWEEN_DURATION_MS, 1);
        const easeProgress = 1 - (1 - progress) ** 3;

        setDisplayScore(Math.round(start + (target - start) * easeProgress));

        if (progress < 1) {
          animationFrame = requestAnimationFrame(animate);
        }
      };

      animationFrame = requestAnimationFrame(animate);

      onCleanup(() => cancelAnimationFrame(animationFrame));
    }),
  );

  const micColor = () => `var(--color-${player.microphone().color}-500)`;
  const isCompact = () => game.playerCount() > 2;

  return (
    <div class={props.class} classList={props.classList}>
      <p
        class="tabular-nums"
        classList={{
          "text-5xl": !isCompact(),
          "text-3xl": isCompact(),
          "animate-score-pop": pop(),
        }}
        style={{ color: micColor() }}
        onAnimationEnd={() => setPop(false)}
      >
        {displayScore().toLocaleString("en-US", {
          maximumFractionDigits: 0,
        })}
      </p>
    </div>
  );
}
