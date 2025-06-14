import { createMemo, For, Show } from "solid-js";
import { useGame } from "~/lib/game/game-context";
import { beatToMs } from "~/lib/ultrastar/bpm";
import type { LocalSong } from "~/lib/ultrastar/parser/local";
import { settingsStore } from "~/stores/settings";

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(Math.abs(seconds) / 60);
  const remainingSeconds = Math.floor(Math.abs(seconds) % 60);
  const sign = seconds < 0 ? "-" : "";
  return `${sign}${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
};

interface NoteSegment {
  start: number;
  end: number;
}

const calculateNoteSegments = (song: LocalSong | undefined, duration: number): NoteSegment[] => {
  if (!song || !song.voices || song.voices.length === 0 || duration === 0) {
    return [];
  }

  const startOffset = song.start ?? 0;
  const endOffset = song.end ? song.end / 1000 : duration;
  const effectiveDuration = Math.max(0, endOffset - startOffset);

  if (effectiveDuration === 0) {
    return [];
  }

  const noteTimings: NoteSegment[] = [];

  for (const voice of song.voices) {
    for (const phrase of voice.phrases) {
      for (const note of phrase.notes) {
        if (note.type === "Freestyle") continue;

        const noteStartMs = beatToMs(song, note.startBeat);
        const noteEndMs = beatToMs(song, note.startBeat + note.length);

        const effectiveStart = Math.max(0, noteStartMs / 1000 - startOffset);
        const effectiveEnd = Math.max(0, noteEndMs / 1000 - startOffset);

        if (effectiveStart < effectiveDuration && effectiveEnd > 0) {
          noteTimings.push({
            start: Math.max(0, effectiveStart),
            end: Math.min(effectiveDuration, effectiveEnd),
          });
        }
      }
    }
  }

  if (noteTimings.length === 0) {
    return [];
  }

  noteTimings.sort((a, b) => a.start - b.start);

  const mergedSegments: NoteSegment[] = [];
  const gapThreshold = 0.5;

  for (let i = 0; i < noteTimings.length; i++) {
    const timing = noteTimings[i];
    if (!timing) continue;

    if (i === 0) {
      mergedSegments.push({ ...timing });
    } else {
      const lastMerged = mergedSegments[mergedSegments.length - 1];
      if (lastMerged && timing.start - lastMerged.end <= gapThreshold) {
        lastMerged.end = Math.max(lastMerged.end, timing.end);
      } else {
        mergedSegments.push({ ...timing });
      }
    }
  }

  return mergedSegments.map((segment) => ({
    start: segment.start / effectiveDuration,
    end: segment.end / effectiveDuration,
  }));
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

  const noteSegments = createMemo(() => {
    const song = game.song();
    const duration = game.duration();
    return calculateNoteSegments(song, duration);
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
      <div class="relative h-1.5 w-full overflow-hidden rounded-full bg-white/20">
        <Show when={settingsStore.general().showNoteSegments}>
          <For each={noteSegments()}>
            {(segment) => (
              <div
                class="absolute top-0 h-full rounded-full bg-white/30 shadow-sm"
                style={{
                  left: `${segment.start * 100}%`,
                  width: `${(segment.end - segment.start) * 100}%`,
                }}
              />
            )}
          </For>
        </Show>
        <div
          class="relative z-10 h-full rounded-full transition-colors duration-500"
          style={{ width: `${timingInfo().progress * 100}%`, "background-color": progressColor() }}
        />
      </div>
      <div class="mr-auto rounded-full bg-white/20 px-1.5 py-0.5 text-sm text-white">{formatTime(timingInfo().remaining)}</div>
    </div>
  );
}
