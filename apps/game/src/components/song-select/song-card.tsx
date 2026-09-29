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
      {(url) => <img class="h-full w-full object-cover" src={url()} alt={props.title} draggable={false} />}
    </Show>
  );
}

interface SongCardProps extends CoverProps {
  /** 0 = at rest, 1 = centred/selected. The centred cover lifts and brightens. */
  emphasis?: number;
}

/** Cover in the coverflow. */
export function SongCard(props: SongCardProps) {
  const emphasis = () => props.emphasis ?? 0;

  return (
    <button
      type="button"
      class="relative mx-4 aspect-square w-40 cursor-pointer active:scale-95 active:transition-transform active:duration-250"
    >
      <div
        class="relative h-full w-full overflow-hidden rounded-xl bg-black"
        style={{
          transform: `translateY(${-emphasis() * 0.6}cqw)`,
          "box-shadow": `0 ${0.4 + emphasis()}cqw ${1 + emphasis() * 2}cqw rgb(0 0 0 / ${0.35 + emphasis() * 0.25})`,
          filter: `brightness(${0.6 + 0.4 * emphasis()})`,
        }}
      >
        <Cover coverUrl={props.coverUrl} title={props.title} lazy={props.lazy} />
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
      class="relative aspect-square w-full cursor-pointer overflow-hidden rounded-xl bg-black transition-all duration-200 ease-out active:scale-95"
      style={{
        transform: props.selected ? "translateY(-0.4cqw) scale(1.04)" : undefined,
        "box-shadow": props.selected ? "0 1.2cqw 2.5cqw rgb(0 0 0 / 0.55)" : "0 0.3cqw 0.8cqw rgb(0 0 0 / 0.35)",
        filter: props.selected ? undefined : "brightness(0.65)",
      }}
    >
      <Cover coverUrl={props.coverUrl} title={props.title} lazy={props.lazy} />
    </div>
  );
}
