import { createEffect, createSignal, For, type JSX, on, onCleanup, Show, untrack } from "solid-js";
import IconDuet from "~icons/ph/users-fill";

import { effectsEnabled } from "~/lib/fx";
import { t } from "~/lib/i18n";

/** What the title panel shows for a song, independent of where it comes from. */
export interface SongInfo {
  id: string;
  artist: string;
  title: string;
  /** Small muted chips, e.g. year, genre, language. */
  meta: string[];
  duet: boolean;
  isNew: boolean;
  /** Extra badges after the meta chips, e.g. rating stars for online songs. */
  extras?: JSX.Element;
}

/** Info chip under the title: year, genre, duet, new. */
export const CHIP =
  "inline-flex items-center gap-[0.4cqw] rounded-[0.5cqw] px-[0.9cqw] py-[0.2cqw] text-[0.85cqw] font-bold backdrop-blur-sm";

// "Fade through": the old text leaves first, then the new one enters. Overlapping
// them reads as ghosting, especially when consecutive titles are similar.
const EXIT_MS = 100;

interface SongTitleProps {
  song: SongInfo | null | undefined;
  /** Tailwind max-width class for the title. */
  maxWidthClass?: string;
}

interface Layer {
  id: number;
  song: SongInfo;
  leaving: boolean;
  createdAt: number;
}

/**
 * Artist, title and badges of the selected song. Changes fade through: the old
 * text drifts up and out, then the new one rises in (artist, title, badges), so
 * fast scrolling stays calm instead of flashing.
 */
export function SongTitle(props: SongTitleProps) {
  const [layers, setLayers] = createSignal<Layer[]>([]);
  let nextId = 0;
  const exitTimers = new Set<ReturnType<typeof setTimeout>>();
  onCleanup(() => exitTimers.forEach(clearTimeout));

  createEffect(
    // Keyed by id: a fresh SongInfo object for the same song must not replay the transition.
    on(
      () => props.song?.id,
      () => {
        const song = untrack(() => props.song);
        const animate = effectsEnabled();
        const now = performance.now();
        setLayers((current) => {
          // Layers that never got to appear (fast scrolling) are dropped right away.
          const kept = animate
            ? current
                .filter((layer) => layer.leaving || now - layer.createdAt >= EXIT_MS)
                .map((layer) => ({ ...layer, leaving: true }))
            : [];
          return song ? [...kept, { id: nextId++, song, leaving: false, createdAt: now }] : kept;
        });

        if (animate) {
          const timer = setTimeout(() => {
            exitTimers.delete(timer);
            setLayers((current) => current.filter((layer) => !layer.leaving));
          }, EXIT_MS);
          exitTimers.add(timer);
        }
      },
    ),
  );

  return (
    // Fixed height for artist + two title lines + badges, with each layer anchored to
    // the bottom: one- and two-line titles swap without moving anything around them.
    <div class="relative grid h-[12.5cqw]">
      {/* Soft scrim keeps the title readable over bright preview videos. `closest-side` fades it out
          inside its box, so the box edge never shows as a line next to the song grid. */}
      <div
        class="pointer-events-none absolute -inset-y-[5cqw] -right-[10cqw] -left-[6cqw] -z-1"
        style={{
          background:
            "radial-gradient(closest-side, rgb(0 0 0 / 0.34), rgb(0 0 0 / 0.26) 35%, rgb(0 0 0 / 0.12) 72%, transparent)",
        }}
      />
      <For each={layers()}>
        {(layer) => (
          <div
            class="col-start-1 row-start-1 flex h-full flex-col justify-end"
            classList={{
              "pointer-events-none animate-title-out": layer.leaving,
            }}
          >
            <p
              class="truncate text-[1.4cqw] leading-tight font-bold text-white/80"
              classList={{ "animate-title-in [animation-delay:100ms]": !layer.leaving && effectsEnabled() }}
            >
              {layer.song.artist}
            </p>
            <div class={props.maxWidthClass ?? "max-w-full"}>
              <span
                class="mt-[0.3cqw] line-clamp-2 pb-[0.1em] text-[3.8cqw] leading-[1.05] font-black tracking-tight"
                classList={{ "animate-title-in [animation-delay:130ms]": !layer.leaving && effectsEnabled() }}
              >
                {layer.song.title}
              </span>
            </div>
            <div
              class="mt-[0.5cqw] flex h-[1.8cqw] origin-left items-center gap-[0.5cqw]"
              classList={{ "animate-badge-in": !layer.leaving && effectsEnabled() }}
            >
              <Show when={layer.song.isNew}>
                <span class={`gradient-sing bg-linear-to-r ${CHIP}`}>{t("sing.badge.new")}</span>
              </Show>
              <For each={layer.song.meta}>{(value) => <span class={`bg-white/15 ${CHIP}`}>{value}</span>}</For>
              <Show when={layer.song.duet}>
                <span class={`bg-white/15 ${CHIP}`}>
                  <IconDuet />
                  {t("sing.badge.duet")}
                </span>
              </Show>
              {layer.song.extras}
            </div>
          </div>
        )}
      </For>
    </div>
  );
}
