import { createEffect, createMemo, createSignal, on, onCleanup } from "solid-js";

import { effectsEnabled } from "~/lib/fx";
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

  let popFrame: number | undefined;
  onCleanup(() => {
    if (popFrame !== undefined) cancelAnimationFrame(popFrame);
  });

  createEffect(
    on(targetScore, (target, previousTarget) => {
      // The tween starts from whatever is shown right now, even mid-tween.
      const initialScore = displayScore();
      if (target === initialScore) {
        return;
      }

      // Pop when a meaningful amount of points lands at once.
      if (previousTarget !== undefined && target - previousTarget > POP_THRESHOLD) {
        setPop(false);
        // Restart the animation on the next frame.
        if (popFrame !== undefined) cancelAnimationFrame(popFrame);
        popFrame = requestAnimationFrame(() => setPop(true));
      }

      const startTime = performance.now();
      let animationFrame: number;

      const animate = (currentTime: number) => {
        const progress = Math.min((currentTime - startTime) / TWEEN_DURATION_MS, 1);
        const easeProgress = 1 - (1 - progress) ** 3;

        setDisplayScore(Math.round(initialScore + (target - initialScore) * easeProgress));

        if (progress < 1) {
          animationFrame = requestAnimationFrame(animate);
        }
      };

      animationFrame = requestAnimationFrame(animate);

      onCleanup(() => cancelAnimationFrame(animationFrame));
    }),
  );

  const isCompact = () => game.playerCount() > 2;

  return (
    <div class={props.class} classList={props.classList}>
      <p
        class="text-display tabular-nums"
        classList={{
          "text-5xl": !isCompact(),
          "text-3xl": isCompact(),
          "animate-score-pop": pop() && !effectsEnabled(),
          "animate-score-rush": pop() && effectsEnabled(),
        }}
        // White digits on a shadow in the singer's colour, like the rest of the display type.
        style={{ "--display-shadow": player.micColor(800) }}
        onAnimationEnd={() => setPop(false)}
      >
        {displayScore().toLocaleString("en-US", {
          maximumFractionDigits: 0,
        })}
      </p>
    </div>
  );
}
