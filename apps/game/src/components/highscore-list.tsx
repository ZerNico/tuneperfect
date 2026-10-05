import { createMemo, For, onCleanup, onMount, Show } from "solid-js";
import { twMerge } from "tailwind-merge";
import IconCrown from "~icons/ph/crown-fill";

import { effectsEnabled } from "~/lib/fx";
import { formatNumber } from "~/lib/i18n";
import type { User } from "~/lib/types";

import Avatar from "./ui/avatar";

/** Gold, silver and bronze for the podium; white for everyone else. */
function rankText(rank: number) {
  if (rank === 1) return "var(--color-yellow-300)";
  if (rank === 2) return "var(--color-slate-300)";
  if (rank === 3) return "var(--color-orange-400)";
  return "rgb(255 255 255 / 0.6)";
}

const fmt = formatNumber;

export interface Highscore {
  score: number;
  user: User;
}

interface RankedHighscore extends Highscore {
  rank: number;
}

interface HighscoreListProps {
  scores: Highscore[];
  class?: string;
  classList?: Record<string, boolean>;
}

export default function HighscoreList(props: HighscoreListProps) {
  let containerRef: HTMLDivElement | undefined;

  const rankedScores = createMemo((): RankedHighscore[] => {
    // First, deduplicate by user ID, keeping only the highest score for each user
    const deduplicatedScores = new Map<string, Highscore>();

    for (const score of props.scores) {
      if (!score || !score.user) continue;

      const userId = score.user.id;
      const existingScore = deduplicatedScores.get(userId);

      if (!existingScore || score.score > existingScore.score) {
        deduplicatedScores.set(userId, score);
      }
    }

    const sortedScores = Array.from(deduplicatedScores.values()).toSorted((a, b) => b.score - a.score);

    // Calculate ranks with gaps for ties
    const ranked: RankedHighscore[] = [];
    let currentRank = 1;

    for (let i = 0; i < sortedScores.length; i++) {
      const score = sortedScores[i];
      const previousScore = sortedScores[i - 1];

      if (!score) continue;

      if (i > 0 && previousScore && score.score !== previousScore.score) {
        currentRank = i + 1;
      }

      ranked.push({
        score: score.score,
        user: score.user,
        rank: currentRank,
      });
    }

    return ranked;
  });

  // Auto-scroll: after a pause, creep down to the end, wait, jump back to the top, wait, repeat.
  let timer: ReturnType<typeof setTimeout> | undefined;
  let alive = true;
  const after = (ms: number, step: () => void) => {
    if (alive) timer = setTimeout(step, ms);
  };

  const scroll = () => {
    if (!containerRef) return;
    const { scrollTop, scrollHeight, clientHeight } = containerRef;

    // Nothing to scroll (yet): check again later, e.g. once more scores have loaded.
    if (scrollHeight <= clientHeight) return after(3000, scroll);

    if (scrollTop < scrollHeight - clientHeight - 1) {
      containerRef.scrollTop += 1;
      return after(50, scroll);
    }

    after(1000, () => {
      containerRef?.scrollTo({ top: 0, behavior: "smooth" });
      after(1500, scroll);
    });
  };

  onMount(() => after(3000, scroll));

  onCleanup(() => {
    alive = false;
    clearTimeout(timer);
  });

  return (
    <div class={twMerge("relative h-full w-100", props.class)}>
      <div ref={containerRef} class="styled-scrollbars absolute flex h-full w-full flex-col overflow-y-auto">
        <div class="flex min-h-full flex-col justify-center-safe gap-2 px-2">
          <div class="flex flex-col gap-1">
            <For each={rankedScores()}>
              {(score, index) => (
                <div
                  class="flex h-9 w-full shrink-0 items-center gap-2.5 rounded-[0.7cqw] bg-black/30 px-3 text-base font-bold"
                  classList={{
                    "animate-title-in": effectsEnabled(),
                    "ring-[0.12cqw] ring-yellow-300/70 ring-inset": score.rank === 1,
                  }}
                  style={{ "animation-delay": `${Math.min(index(), 8) * 40}ms` }}
                >
                  <span class="w-5 shrink-0 text-center font-black" style={{ color: rankText(score.rank) }}>
                    {score.rank}
                  </span>
                  <Avatar user={score.user} class="h-6 w-6 shrink-0" />
                  <span class="min-w-0 truncate">{score.user.username || "?"}</span>
                  <Show when={score.rank === 1}>
                    <IconCrown class="shrink-0 text-yellow-300" />
                  </Show>
                  <span class="ml-auto shrink-0 pl-3 font-black tabular-nums">{fmt(score.score)}</span>
                </div>
              )}
            </For>
          </div>
        </div>
      </div>
    </div>
  );
}
