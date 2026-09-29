import { createEffect, createSignal, For, type JSX, on, Show, untrack } from "solid-js";
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
          setTimeout(() => setLayers((current) => current.filter((layer) => !layer.leaving)), EXIT_MS);
        }
      },
    ),
  );

  return (
    // Fixed height for artist + two title lines + badges, with each layer anchored to
    // the bottom: one- and two-line titles swap without moving anything around them.
    <div class="relative grid h-[11.5cqw]">
      {/* Soft scrim keeps the title readable over bright preview videos. */}
      <div
        class="pointer-events-none absolute -inset-x-16 -inset-y-10 -z-1"
        style={{ background: "radial-gradient(ellipse at 20% 50%, rgb(0 0 0 / 0.45), transparent 70%)" }}
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
              class="text-xl font-semibold"
              classList={{ "animate-title-in [animation-delay:100ms]": !layer.leaving && effectsEnabled() }}
            >
              {layer.song.artist}
            </p>
            <div class={props.maxWidthClass ?? "max-w-full"}>
              <span
                // Padding (offset by negative margins) gives italic overhangs and
                // descenders room inside the gradient's box so they aren't clipped.
                class="gradient-sing -mx-[0.1em] -my-[0.12em] line-clamp-2 bg-linear-to-b bg-clip-text px-[0.1em] py-[0.12em] pr-[0.2em] text-6xl leading-[1.1] font-black text-transparent italic"
                classList={{ "animate-title-in [animation-delay:130ms]": !layer.leaving && effectsEnabled() }}
              >
                {layer.song.title}
              </span>
            </div>
            <div
              class="flex h-8 origin-left items-center gap-2 pt-1"
              classList={{ "animate-badge-in": !layer.leaving && effectsEnabled() }}
            >
              <Show when={layer.song.duet}>
                <span class="inline-flex -skew-x-12 items-center rounded-sm bg-white px-2.5 py-0.5 text-sm font-black text-black uppercase shadow-md">
                  <span class="inline-flex skew-x-12 items-center gap-1.5">
                    <IconDuet />
                    {t("sing.badge.duet")}
                  </span>
                </span>
              </Show>
              <For each={layer.song.meta}>
                {(value) => (
                  <span class="inline-block -skew-x-12 rounded-sm bg-black/35 px-2.5 py-0.5 text-sm font-bold text-white/90 backdrop-blur-sm">
                    <span class="inline-block skew-x-12">{value}</span>
                  </span>
                )}
              </For>
              <Show when={layer.song.isNew}>
                <span class="gradient-sing inline-block -skew-x-12 rounded-sm bg-linear-to-b px-2.5 py-0.5 text-sm font-black text-white uppercase shadow-md">
                  <span class="inline-block skew-x-12">{t("sing.badge.new")}</span>
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
