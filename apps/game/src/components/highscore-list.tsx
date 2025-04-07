import { For, onCleanup, onMount } from "solid-js";
import { twMerge } from "tailwind-merge";
import type { User } from "~/lib/types";
import Avatar from "./ui/avatar";

interface HighscoreListProps {
  scores: {
    score: number;
    user: User;
  }[];
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
        containerRef.scrollTop = 0;
      } else {
        containerRef.scrollTop += 1;
      }

      scrollTimeout = setTimeout(scroll, 50);
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
    <div class={twMerge("relative overflow-hidden", props.class)}>
      <div ref={containerRef} class="styled-scrollbars h-full overflow-y-auto">
        <div class="flex flex-col gap-2">
          <For each={props.scores}>
            {(score, index) => (
              <div class="flex h-7 w-full items-center gap-2 overflow-hidden rounded-lg bg-black/20 pr-4">
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

                <span class="flex-shrink-0 tabular-nums">{score.score.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
              </div>
            )}
          </For>
        </div>
      </div>
    </div>
  );
}
