import { createEffect, createMemo, createSignal, on, onCleanup } from "solid-js";

import { effectsEnabled } from "~/lib/fx";
import { useGame } from "~/lib/game/game-context";
import { usePlayer } from "~/lib/game/player-context";

const TWEEN_DURATION_MS = 250;
const POP_THRESHOLD = 500;

// Bigger score jumps: a quick swell and smear, like the digits are rushing in. Only transform and
// filter, and the keyframes are shared, so a pop allocates nothing but the animation itself.
const POP_KEYFRAMES: Keyframe[] = [{ transform: "scale(1)" }, { transform: "scale(1.08)" }, { transform: "scale(1)" }];
const RUSH_KEYFRAMES: Keyframe[] = [
  { transform: "scale(1)", filter: "blur(0)" },
  { transform: "scale(1.14)", filter: "blur(0.12cqw)", offset: 0.35 },
  { transform: "scale(1)", filter: "blur(0)" },
];
const POP_OPTIONS: KeyframeAnimationOptions = { duration: 200, easing: "ease-out" };
const RUSH_OPTIONS: KeyframeAnimationOptions = { duration: 300, easing: "ease-out" };

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

  let scoreRef: HTMLParagraphElement | undefined;
  let popAnimation: Animation | undefined;
  onCleanup(() => popAnimation?.cancel());

  const pop = () => {
    // Restarts a running pop.
    popAnimation?.cancel();
    popAnimation = effectsEnabled()
      ? scoreRef?.animate(RUSH_KEYFRAMES, RUSH_OPTIONS)
      : scoreRef?.animate(POP_KEYFRAMES, POP_OPTIONS);
  };

  createEffect(
    on(targetScore, (target, previousTarget) => {
      // The tween starts from whatever is shown right now, even mid-tween.
      const initialScore = displayScore();
      if (target === initialScore) {
        return;
      }

      // Pop when a meaningful amount of points lands at once.
      if (previousTarget !== undefined && target - previousTarget > POP_THRESHOLD) {
        pop();
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
        ref={scoreRef}
        class="font-black tracking-[-0.01em] tabular-nums [text-shadow:0_0.15cqw_0_rgb(0_0_0/0.35)]"
        classList={{
          "text-5xl": !isCompact(),
          "text-3xl": isCompact(),
        }}
        // Digits in the singer's colour; a short, unblurred shadow (no haze on light videos).
        style={{ color: player.micColor(500) }}
      >
        {displayScore().toLocaleString("en-US", {
          maximumFractionDigits: 0,
        })}
      </p>
    </div>
  );
}
