import { createMemo } from "solid-js";
import { useGame } from "~/lib/game/game-context";
import { settingsStore } from "~/stores/settings";

export default function Progress() {
  const game = useGame();

  const progress = () => {
    const song = game.song();
    const rawCurrentTime = game.currentTime();
    const rawDuration = game.duration();
    
    if (!song || rawDuration === 0) return 0;
    
    // Calculate effective current time and duration based on song's start/end
    const startOffset = song.start ?? 0;
    const endOffset = song.end ? song.end / 1000 : rawDuration; // Convert milliseconds to seconds
    
    const effectiveCurrentTime = Math.max(0, rawCurrentTime - startOffset);
    const effectiveDuration = Math.max(0, endOffset - startOffset);
    
    if (effectiveDuration === 0) return 0;
    
    return Math.min(1, effectiveCurrentTime / effectiveDuration);
  };

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
    <div class="flex h-full w-full items-center justify-center p-20">
      <div class="h-1.5 w-full overflow-hidden rounded-full bg-white/20">
        <div
          class="h-full rounded-full transition-colors duration-500"
          style={{ width: `${progress() * 100}%`, "background-color": progressColor() }}
        />
      </div>
    </div>
  );
}
