import { For, onCleanup, onMount } from "solid-js";
import { twMerge } from "tailwind-merge";
import type { User } from "~/lib/types";
import IconHash from "~icons/lucide/hash";
import Avatar from "./ui/avatar";

export interface Highscore {
  score: number;
  user: User;
}

interface HighscoreListProps {
  scores: Highscore[];
  class?: string;
  classList?: Record<string, boolean>;
}

export default function HighscoreList(props: HighscoreListProps) {
  let containerRef: HTMLDivElement | undefined;
  let scrollTimeout: ReturnType<typeof setTimeout>;

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
          <For each={props.scores}>
            {(score, index) => (
              <div class="flex h-7 w-full shrink-0 items-center gap-2 overflow-hidden rounded-lg bg-black/20 pr-4">
                <div
                  class="flex h-full w-10 flex-shrink-0 items-center justify-center text-center"
                  classList={{
                    "bg-yellow-500": index() === 0,
                    "bg-white text-black": index() !== 0,
                  }}
                >
                  {index() + 1}.
                </div>

                <div class="flex flex-grow items-center gap-2 overflow-hidden">
                  <Avatar user={score.user} class="h-6 w-6 flex-shrink-0" />
                  <span class="truncate">{score.user.username || "?"}</span>
                </div>

                <div class="flex flex-shrink-0 flex-row items-center gap-4">
                  <span class="flex flex-shrink-0 flex-row items-center gap-1 text-sm tabular-nums">
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
