import { createMemo, For, onCleanup, onMount } from "solid-js";
import { twMerge } from "tailwind-merge";
import type { User } from "~/lib/types";
import IconHash from "~icons/lucide/hash";
import Avatar from "./ui/avatar";

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
  let scrollTimeout: ReturnType<typeof setTimeout>;

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
    
    const sortedScores = Array.from(deduplicatedScores.values()).sort((a, b) => b.score - a.score);
    
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
        rank: currentRank
      });
    }
    
    return ranked;
  });

  const startScrolling = () => {
    if (!containerRef) return;

    const scroll = () => {
      if (!containerRef) return;

      const { scrollTop, scrollHeight, clientHeight } = containerRef;

      if (scrollTop >= scrollHeight - clientHeight) {
        setTimeout(() => {
          if (!containerRef) return;
          containerRef.scrollTo({
            top: 0,
            behavior: "smooth",
          });
          setTimeout(() => {
            scrollTimeout = setTimeout(scroll, 50);
          }, 1500);
        }, 1000);
      } else {
        containerRef.scrollTop += 1;
        scrollTimeout = setTimeout(scroll, 50);
      }
    };

    setTimeout(scroll, 3000);
  };

  onMount(() => {
    if (containerRef) {
      startScrolling();
    }
  });

  onCleanup(() => {
    clearTimeout(scrollTimeout);
  });

  return (
    <div class={twMerge("relative h-full w-100", props.class)}>
      <div ref={containerRef} class="styled-scrollbars absolute flex h-full w-full flex-col overflow-y-auto">
        <div class="justify-center-safe flex min-h-full flex-col gap-2">
          <For each={rankedScores()}>
            {(score) => (
              <div class="flex h-7 w-full shrink-0 items-center gap-2 overflow-hidden rounded-lg bg-black/20 pr-4 backdrop-blur-md">
                <div
                  class="flex h-full w-10 shrink-0 items-center justify-center text-center"
                  classList={{
                    "bg-yellow-500": score.rank === 1,
                    "bg-white text-black": score.rank !== 1,
                  }}
                >
                  {score.rank}.
                </div>

                <div class="flex grow items-center gap-2 overflow-hidden">
                  <Avatar user={score.user} class="h-6 w-6 shrink-0" />
                  <span class="truncate">{score.user.username || "?"}</span>
                </div>

                <div class="flex shrink-0 flex-row items-center gap-4">
                  <span class="flex shrink-0 flex-row items-center gap-1 text-sm tabular-nums">
                    <IconHash />
                    {score.score.toLocaleString("en-US", { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
