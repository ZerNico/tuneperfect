import { createMemo } from "solid-js";
import { usePlayer } from "~/lib/game/player-context";

interface ScoreProps {
  class?: string;
  classList?: {
    [k: string]: boolean | undefined;
  };
}

export default function Score(props: ScoreProps) {
  const player = usePlayer();

  const score = createMemo(() => {
    const maxScore = player.maxScore();
    const currentScore = player.score();

    const maxScoreTotal = maxScore.normal + maxScore.golden + maxScore.bonus;
    const currentScoreTotal = currentScore.normal + currentScore.golden + currentScore.bonus;

    if (maxScoreTotal === 0) return "0";

    const score = (currentScoreTotal / maxScoreTotal) * 100000;

    return score.toLocaleString("en-US", {
      maximumFractionDigits: 0,
    });
  });

  const micColor = () => `var(--color-${player.microphone().color}-500)`;

  return (
    <div class={props.class} classList={props.classList}>
      <p class="text-5xl tabular-nums" style={{ color: micColor() }}>
        {score()}
      </p>
    </div>
  );
}
