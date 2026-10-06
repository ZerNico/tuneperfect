import { createSignal, onCleanup, onMount, Show } from "solid-js";
import IconMusic from "~icons/ph/music-notes-fill";

interface CoverProps {
  coverUrl: string | null;
  title: string;
  /** Delay loading the image briefly, so fast scrolling doesn't fetch every cover (remote catalogues). */
  lazy?: boolean;
}

function Cover(props: CoverProps) {
  // Read once: a cover decides at mount whether to defer loading.
  // oxlint-disable-next-line solid/reactivity
  const [ready, setReady] = createSignal(!props.lazy);
  let timer: ReturnType<typeof setTimeout> | undefined;
  onMount(() => {
    if (props.lazy) timer = setTimeout(() => setReady(true), 150);
  });
  onCleanup(() => clearTimeout(timer));

  return (
    <Show
      when={ready() && props.coverUrl}
      fallback={
        <div class="flex h-full w-full items-center justify-center bg-white/8">
          <IconMusic class="text-4xl opacity-25" />
        </div>
      }
    >
      {(url) => (
        <img class="h-full w-full object-cover" src={url()} alt={props.title} draggable={false} decoding="async" />
      )}
    </Show>
  );
}

interface SongCardProps extends CoverProps {
  /** 0 = at rest, 1 = centred/selected. The centred cover lifts and brightens. */
  emphasis?: number;
  /** Pointer cursor and press feedback; off for covers that can't be clicked. Defaults to true. */
  clickable?: boolean;
  /** Soft drop shadow under the cover. Defaults to true. */
  shadow?: boolean;
}

/** Cover in the coverflow. */
export function SongCard(props: SongCardProps) {
  const emphasis = () => props.emphasis ?? 0;

  return (
    <button
      type="button"
      class="relative aspect-square w-[84%]"
      classList={{
        "cursor-pointer active:scale-95 active:transition-transform active:duration-250": props.clickable !== false,
        "cursor-default": props.clickable === false,
      }}
    >
      {/* Emphasis changes every frame while scrolling, so it only moves and fades layers: a dark
          overlay instead of a brightness filter, a separate outline instead of recolouring one. */}
      <div class="relative h-full w-full" style={{ transform: `translateY(${-emphasis() * 0.6}cqw)` }}>
        <div
          class="relative h-full w-full overflow-hidden rounded-[1cqw] bg-black"
          classList={{ "shadow-[0_0.15cqw_0_rgb(0_0_0/0.3)]": props.shadow !== false }}
        >
          <Cover coverUrl={props.coverUrl} title={props.title} lazy={props.lazy} />
          <div class="absolute inset-0 bg-black" style={{ opacity: 0.4 * (1 - emphasis()) }} />
        </div>
        {/* The centred cover gets a white outline, fading in as it arrives; no glow around images. */}
        <div
          class="pointer-events-none absolute inset-0 rounded-[1cqw] outline-[0.18cqw] outline-white outline-solid"
          style={{ opacity: emphasis() }}
        />
      </div>
    </button>
  );
}

interface SongGridCardProps extends CoverProps {
  selected: boolean;
}

/** Cover in the grid: same look as the coverflow's centred cover when selected. */
export function SongGridCard(props: SongGridCardProps) {
  return (
    <div
      class="relative aspect-square w-full cursor-pointer overflow-hidden rounded-[1cqw] bg-black shadow-[0_0.15cqw_0_rgb(0_0_0/0.3)] transition-[translate,scale,filter] duration-200 ease-out active:scale-95"
      classList={{
        "-translate-y-[0.4cqw] scale-106 outline-[0.22cqw] outline-white": props.selected,
        "brightness-65": !props.selected,
      }}
    >
      <Cover coverUrl={props.coverUrl} title={props.title} lazy={props.lazy} />
    </div>
  );
}
