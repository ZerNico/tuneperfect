import { createEffect, createMemo, createSignal, on, onCleanup, untrack } from "solid-js";

import { effectsEnabled } from "~/lib/fx";
import { useGame } from "~/lib/game/game-context";
import { usePlayer } from "~/lib/game/player-context";

const TWEEN_DURATION_MS = 250;
// `toLocaleString` with options builds a formatter on every call; this runs every frame of a count-up.
const SCORE_FORMAT = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
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

  // One count-up loop that retargets: the score changes on nearly every sung beat, so starting a
  // fresh tween (closures and a frame chain) each time adds up with four singers.
  let tweenFrom = 0;
  let tweenTo = 0;
  let tweenStart = 0;
  let frame: number | undefined;
  onCleanup(() => frame !== undefined && cancelAnimationFrame(frame));

  const step = (now: number) => {
    const progress = Math.min((now - tweenStart) / TWEEN_DURATION_MS, 1);
    setDisplayScore(Math.round(tweenFrom + (tweenTo - tweenFrom) * (1 - (1 - progress) ** 3)));
    frame = progress < 1 ? requestAnimationFrame(step) : undefined;
  };

  createEffect(
    on(targetScore, (target, previousTarget) => {
      // The tween starts from whatever is shown right now, even mid-tween.
      tweenFrom = untrack(displayScore);
      if (target === tweenFrom) {
        return;
      }

      // Pop when a meaningful amount of points lands at once.
      if (previousTarget !== undefined && target - previousTarget > POP_THRESHOLD) {
        pop();
      }

      tweenTo = target;
      tweenStart = performance.now();
      frame ??= requestAnimationFrame(step);
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
        {SCORE_FORMAT.format(displayScore())}
      </p>
    </div>
  );
}
