import { createMemo } from "solid-js";
import { useGame } from "~/lib/game/game-context";
import { settingsStore } from "~/stores/settings";

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(Math.abs(seconds) / 60);
  const remainingSeconds = Math.floor(Math.abs(seconds) % 60);
  const sign = seconds < 0 ? "-" : "";
  return `${sign}${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
};

export default function Progress() {
  const game = useGame();

  const timingInfo = createMemo(() => {
    const song = game.song();
    const rawCurrentTime = game.currentTime();
    const rawDuration = game.duration();

    if (!song || rawDuration === 0) {
      return {
        progress: 0,
        elapsed: 0,
        remaining: 0,
      };
    }

    const startOffset = song.start ?? 0;
    const endOffset = song.end ? song.end / 1000 : rawDuration;

    const effectiveCurrentTime = Math.max(0, rawCurrentTime - startOffset);
    const effectiveDuration = Math.max(0, endOffset - startOffset);

    if (effectiveDuration === 0) {
      return {
        progress: 0,
        elapsed: 0,
        remaining: 0,
      };
    }

    const progress = Math.min(1, effectiveCurrentTime / effectiveDuration);
    const remaining = effectiveDuration - effectiveCurrentTime;

    return {
      progress,
      elapsed: effectiveCurrentTime,
      remaining: -remaining,
    };
  });

  const leadingPlayer = createMemo(() => {
    const scores = game.scores();
    const scoresTotal = scores.map((score) => score.normal + score.golden + score.bonus);

    const maxScore = Math.max(...scoresTotal);
    const maxScoreCount = scoresTotal.filter((score) => score === maxScore).length;
    if (maxScoreCount >= 2) {
      return null;
    }

    return scoresTotal.indexOf(maxScore);
  });

  const progressColor = () => {
    const leadingPlayerIndex = leadingPlayer();
    if (leadingPlayerIndex === null) {
      return "var(--color-white)";
    }

    const microphone = settingsStore.microphones()[leadingPlayerIndex];
    const color = microphone ? `var(--color-${microphone.color}-500)` : "var(--color-white)";

    return color;
  };

  return (
    <div class="grid h-full w-full grid-cols-[5cqw_1fr_5cqw] items-center justify-center gap-2">
      <div class="ml-auto rounded-full bg-white/20 px-1.5 py-0.5 text-sm text-white">{formatTime(timingInfo().elapsed)}</div>
      <div class="h-1.5 w-full overflow-hidden rounded-full bg-white/20 ">
        <div
          class="h-full rounded-full transition-colors duration-500"
          style={{ width: `${timingInfo().progress * 100}%`, "background-color": progressColor() }}
        />
      </div>
      <div class="mr-auto rounded-full bg-white/20 px-1.5 py-0.5 text-sm text-white">{formatTime(timingInfo().remaining)}</div>
    </div>
  );
}
