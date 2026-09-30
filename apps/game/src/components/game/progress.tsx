import { createMemo, For, Show } from "solid-js";

import { useGame } from "~/lib/game/game-context";
import { beatToMs } from "~/lib/ultrastar/bpm";
import type { Song } from "~/lib/ultrastar/song";
import { getColorVar } from "~/lib/utils/color";
import { roundStore } from "~/stores/round";
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

/**
 * The part of the media that is played, in seconds: `#START`/`#END` (milliseconds) shorten it,
 * e.g. for medleys and short rounds. `duration` is the media's, NaN until its metadata loaded.
 */
const getPlayedRange = (song: Song, duration: number) => {
  const start = song.start ? song.start / 1000 : 0;
  const end = song.end ? song.end / 1000 : duration;
  return { start, duration: Math.max(0, end - start) || 0 };
};

const calculateNoteSegments = (song: Song | undefined, duration: number): NoteSegment[] => {
  if (!song || !song.voices || song.voices.length === 0 || !(duration > 0)) {
    return [];
  }

  const { start: startOffset, duration: effectiveDuration } = getPlayedRange(song, duration);

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

    if (!song || !(rawDuration > 0)) {
      return {
        progress: 0,
        elapsed: 0,
        remaining: 0,
      };
    }

    const { start: startOffset, duration: effectiveDuration } = getPlayedRange(song, rawDuration);
    const effectiveCurrentTime = Math.max(0, rawCurrentTime - startOffset);

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

    const players = roundStore.settings()?.songs[0]?.players || [];
    const microphone = players[leadingPlayerIndex]?.microphone;
    const color = microphone ? getColorVar(microphone.color, 500) : "var(--color-white)";

    return color;
  };

  return (
    // Full width like the name plates and scores; the bar fills between the times.
    <div class="grid h-full w-full grid-cols-[auto_1fr_auto] items-center gap-4 px-[3cqw]">
      <span class="text-sm font-black tabular-nums">{formatTime(timingInfo().elapsed)}</span>
      <div class="relative h-[0.5cqw] overflow-hidden rounded-full bg-white/20">
        <Show when={settingsStore.general().showNoteSegments}>
          <For each={noteSegments()}>
            {(segment) => (
              <span
                class="absolute inset-y-0 bg-white/30"
                style={{ left: `${segment.start * 100}%`, width: `${(segment.end - segment.start) * 100}%` }}
              />
            )}
          </For>
        </Show>
        {/* Slid in instead of resized: no layout per frame, and the leading end stays round. */}
        <span
          class="absolute inset-0 rounded-full transition-colors duration-500"
          style={{
            transform: `translateX(${(timingInfo().progress - 1) * 100}%)`,
            "background-color": progressColor(),
          }}
        />
      </div>
      <span class="text-sm font-black text-white/60 tabular-nums">{formatTime(timingInfo().remaining)}</span>
    </div>
  );
}
