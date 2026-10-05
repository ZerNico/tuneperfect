import { For, type JSX, Show } from "solid-js";

import { effectsEnabled } from "~/lib/fx";

interface LoadingPanelProps {
  title: JSX.Element;
  /** 0–100, or null while the amount of work isn't known yet (the bar shows moving stripes). */
  progress: number | null;
  /** Small line above the bar, e.g. the status or the song being read. */
  detail?: string;
  /** Right side of the bar's caption, e.g. "120 / 480". Defaults to the percentage. */
  count?: JSX.Element;
  /** Fill of the bar, e.g. "gradient-sing bg-linear-to-r". */
  fill?: string;
}

const BARS = [0.55, 0.9, 0.7, 1, 0.6];

/** Calm loading state: a small equalizer, a title and a rounded progress bar. */
export default function LoadingPanel(props: LoadingPanelProps) {
  return (
    <div class="flex w-[46cqw] flex-col items-center gap-[3cqh]">
      <Equalizer />
      <span class="text-center text-6xl font-bold tracking-tight">{props.title}</span>

      <div class="flex w-full flex-col gap-2">
        <div class="flex items-baseline justify-between gap-4 text-sm font-bold tracking-[0.15em] text-white/60 uppercase">
          <span class="min-w-0 truncate">{props.detail}</span>
          <span class="shrink-0 text-xl font-black tracking-normal text-white tabular-nums">
            {props.count ?? (props.progress !== null ? `${Math.round(props.progress)}%` : "")}
          </span>
        </div>
        <div class="relative h-[1.2cqw] w-full overflow-hidden rounded-full bg-black/35">
          <Show
            when={props.progress !== null}
            fallback={
              <span
                class="absolute inset-0 bg-stripes opacity-25 [--fx-color:white]"
                classList={{ "animate-stripes-move": effectsEnabled() }}
              />
            }
          >
            <span
              class={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 ${props.fill ?? "bg-white"}`}
              style={{ width: `${Math.max(props.progress ?? 0, 2)}%` }}
            />
          </Show>
        </div>
      </div>
    </div>
  );
}

/** Five bars bouncing out of step; still when effects are reduced. */
function Equalizer() {
  return (
    <div class="flex h-[4cqw] items-end gap-[0.5cqw]" aria-hidden="true">
      <For each={BARS}>
        {(height, index) => (
          <span
            class="w-[0.9cqw] origin-bottom rounded-full bg-white"
            classList={{ "animate-eq-bounce": effectsEnabled() }}
            style={{ height: `${height * 100}%`, "animation-delay": `${index() * -160}ms` }}
          />
        )}
      </For>
    </div>
  );
}
