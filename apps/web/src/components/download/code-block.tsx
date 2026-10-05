import { createSignal, Show } from "solid-js";
import IconCheck from "~icons/ph/check-bold";
import IconCopy from "~icons/ph/copy-bold";

/** A shell command with a copy button. */
export default function CodeBlock(props: { label?: string; code: string }) {
  const [copied, setCopied] = createSignal(false);
  const copy = async () => {
    await navigator.clipboard.writeText(props.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div class="flex flex-col gap-2">
      <Show when={props.label}>
        <span class="text-sm font-bold text-white">{props.label}</span>
      </Show>
      <div class="flex items-start gap-2 rounded-[10px] bg-black/40 py-2 pr-2 pl-4">
        <pre class="min-w-0 grow overflow-x-auto py-1 font-mono text-sm whitespace-pre text-white/85">{props.code}</pre>
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={copied() ? "Copied" : "Copy command"}
          class="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-[8px] text-white/60 hover:bg-white/10 hover:text-white"
        >
          <Show when={copied()} fallback={<IconCopy />}>
            <IconCheck class="text-green-400" />
          </Show>
        </button>
      </div>
    </div>
  );
}
