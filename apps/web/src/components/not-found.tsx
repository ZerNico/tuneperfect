import IconHouse from "~icons/ph/house-fill";

import Glow from "./glow";
import Button from "./ui/button";
import Tag from "./ui/tag";

/** 404: a note nobody hit. */
export default function NotFound() {
  return (
    <section class="relative flex min-h-[80dvh] flex-col items-center justify-center gap-6 px-5 pt-28 pb-16 text-center">
      <Glow mode="title" />
      {/* an empty note with a missed bit, as in the game */}
      <div
        class="h-9 w-48 rounded-full border-[3px] border-white bg-black/30 p-[5px] shadow-[0_3px_0_rgb(0_0_0/0.3)]"
        aria-hidden="true"
      >
        <div class="h-full w-[12%] rounded-full bg-sky-500" />
      </div>
      <span class="rounded-[8px] bg-white/15 px-2.5 py-1 text-sm font-bold text-white/70">Miss</span>
      <Tag>404</Tag>
      <h1 class="text-4xl font-bold md:text-6xl">That note isn't in the song.</h1>
      <p class="max-w-md text-lg text-white/65">The page you're looking for doesn't exist (anymore).</p>
      <Button to="/" intent="gradient-sing" size="lg">
        <IconHouse class="text-xl" />
        Back to the start
      </Button>
    </section>
  );
}
