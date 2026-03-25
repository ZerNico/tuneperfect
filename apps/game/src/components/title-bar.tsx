import { Show } from "solid-js";
import IconChevronLeft from "~icons/lucide/chevron-left";

interface TitleBarProps {
  title: string;
  description?: string;
  onBack?: () => void;
}

export default function TitleBar(props: TitleBarProps) {
  return (
    <div class="flex items-center gap-2 text-base font-semibold uppercase">
      <Show when={props.onBack}>
        <button class="flex cursor-pointer items-center gap-2" onClick={() => props.onBack?.()} type="button">
          <IconChevronLeft />
        </button>
      </Show>
      <div>
        {props.title}
        <Show when={props.description}>
          <span class="pl-2 text-xs">/ {props.description}</span>
        </Show>
      </div>
    </div>
  );
}
