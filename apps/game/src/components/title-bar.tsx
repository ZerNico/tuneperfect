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
    <div class="flex items-center gap-4">
      <Show when={props.onBack}>
        <button
          class="flex h-10 w-10 cursor-pointer items-center justify-center rounded-full bg-white/10 text-xl transition-colors hover:bg-white/20"
          onClick={() => props.onBack?.()}
          type="button"
        >
          <IconCaretLeft />
        </button>
      </Show>
      <h1 class="text-4xl font-bold">{props.title}</h1>
      <Show when={props.description}>
        <TagChip class="text-base" label={props.description} />
      </Show>
    </div>
  );
}
