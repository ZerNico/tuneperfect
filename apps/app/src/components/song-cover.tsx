import { useQuery } from "@tanstack/solid-query";
import type { GameClient } from "@tuneperfect/webrtc/contracts/game";
import { createSignal, Show, Suspense } from "solid-js";
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
  // Only covers that stay on screen briefly: flicking through a long list shouldn't request every cover passed.
  const inView = useInView(element, { delay: 150 });

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
      {/*
        Own Suspense boundary: reading a loading query suspends the nearest one, and without this that is the
        page's, which blanks the whole list (and resets the scroll) every time a cover starts loading.
      */}
      <Suspense fallback={<Placeholder />}>
        <Show when={cover.data} fallback={<Placeholder />}>
          {(src) => <img src={src()} alt="" class="size-full object-cover" />}
        </Show>
      </Suspense>
    </div>
  );
}

function Placeholder() {
  return <IconMusicNotes class="absolute inset-0 m-auto size-[40%] text-white/25" />;
}
