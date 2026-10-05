import { Show } from "solid-js";
import IconCaretLeft from "~icons/ph/caret-left-bold";

import TagChip from "./fx/tag-chip";

interface TitleBarProps {
  title: string;
  description?: string;
  onBack?: () => void;
}

export default function TitleBar(props: TitleBarProps) {
  return (
    <div class="flex items-center gap-3">
      <Show when={props.onBack}>
        <button
          class="flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white/10 text-lg transition-colors hover:bg-white/20"
          onClick={() => props.onBack?.()}
          type="button"
        >
          <IconCaretLeft />
        </button>
      </Show>
      {/* `text-box` trims the line boxes to cap height / baseline, so centring lines up the letters themselves. */}
      <h1 class="text-3xl font-bold [text-box:trim-both_cap_alphabetic]">{props.title}</h1>
      <Show when={props.description}>
        <TagChip
          class="ml-1 text-sm [&>span]:py-[0.4em] [&>span]:[text-box:trim-both_cap_alphabetic]"
          label={props.description}
        />
      </Show>
    </div>
  );
}
