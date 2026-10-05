import { For, type JSX, Show } from "solid-js";
import IconDownload from "~icons/ph/download-simple-bold";

import Button from "~/components/ui/button";
import Tag from "~/components/ui/tag";

interface DownloadCardProps {
  class?: string;
  icon: JSX.Element;
  title: string;
  subtitle: string;
  description: string;
  /** Small chips, e.g. the architecture. */
  tags: string[];
  recommended?: boolean;
  extension: string;
  url: string;
  onDownload?: () => void;
}

export default function DownloadCard(props: DownloadCardProps) {
  return (
    <div
      class={`relative flex flex-col gap-6 overflow-hidden rounded-[16px] p-6 shadow-crisp ${props.class ?? ""}`}
      classList={{ "bg-white/10 ring-2 ring-white/70": props.recommended, "bg-white/5": !props.recommended }}
    >
      <div class="flex items-start gap-4">
        <span
          class="flex size-12 shrink-0 items-center justify-center rounded-[12px] text-2xl"
          classList={{ "gradient-settings shadow-crisp": props.recommended, "bg-white/10": !props.recommended }}
        >
          {props.icon}
        </span>
        <div class="min-w-0 grow">
          <h2 class="text-xl font-bold">{props.title}</h2>
          <p class="text-sm text-white/55">{props.subtitle}</p>
        </div>
      </div>

      <p class="text-white/70">{props.description}</p>
      <div class="flex flex-wrap items-center gap-2">
        <Show when={props.recommended}>
          <Tag>Recommended</Tag>
        </Show>
        <For each={props.tags}>
          {(tag) => <span class="rounded-[6px] bg-black/30 px-2 py-1 font-mono text-xs text-white/70">{tag}</span>}
        </For>
      </div>

      <Button
        href={props.url}
        intent={props.recommended ? "gradient-settings" : "primary"}
        class="mt-auto self-start"
        onClick={() => props.onDownload?.()}
      >
        <IconDownload />
        Download .{props.extension}
      </Button>
    </div>
  );
}
