import { useQuery } from "@tanstack/solid-query";
import type { GameClient } from "@tuneperfect/webrtc/contracts/game";
import { createSignal, Show } from "solid-js";
import IconMusicNotes from "~icons/ph/music-notes-fill";

import { useInView } from "~/hooks/use-in-view";
import { songCoverQueryOptions } from "~/lib/game-query";

interface SongCoverProps {
  hash: string;
  client: GameClient | null;
  class?: string;
}

/** A song's cover, loaded from the game once it scrolls near the screen; a note placeholder until then. */
export default function SongCover(props: SongCoverProps) {
  const [element, setElement] = createSignal<HTMLDivElement>();
  const inView = useInView(element);

  const cover = useQuery(() => ({
    ...songCoverQueryOptions(props.client, props.hash),
    enabled: !!props.client && inView(),
  }));

  return (
    <div
      ref={setElement}
      class={`relative shrink-0 overflow-hidden bg-white/8 ${props.class ?? ""}`}
      aria-hidden="true"
    >
      <Show when={cover.data} fallback={<IconMusicNotes class="absolute inset-0 m-auto size-[40%] text-white/25" />}>
        {(src) => <img src={src()} alt="" class="size-full object-cover" />}
      </Show>
    </div>
  );
}
