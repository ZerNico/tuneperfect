import { createSignal, For, onMount } from "solid-js";
import { Dynamic } from "solid-js/web";
import IconDownload from "~icons/ph/download-simple-bold";
import IconGithub from "~icons/ph/github-logo-fill";

import Glow from "~/components/glow";
import Button from "~/components/ui/button";
import { PLATFORMS } from "~/lib/platform";

interface HeroNote {
  /** Position and width, in % of the hero. */
  class: string;
  /** Background class for the fill, in a singer's colour. */
  fill: string;
  golden?: boolean;
  /** Fill timing, in ms. */
  delay: number;
  duration: number;
}

// Two short phrases, like notes in a lane: one climbing above the title, one falling below it, each filled note by
// note as if sung. Phones get their own, wider spacing. Two strays join on large screens.
const NOTES: HeroNote[] = [
  {
    class: "top-[24%] left-[7%] w-[14%] lg:top-[31%] lg:left-[5%] lg:w-[6%]",
    fill: "bg-sky-500",
    delay: 400,
    duration: 700,
  },
  {
    class: "top-[19%] left-[24%] w-[20%] lg:top-[25%] lg:left-[12%] lg:w-[9%]",
    fill: "bg-sky-500",
    delay: 1150,
    duration: 1000,
  },
  {
    class: "top-[14%] left-[47%] w-[11%] lg:top-[18%] lg:left-[22.5%] lg:w-[5%]",
    fill: "bg-sky-500",
    delay: 2200,
    duration: 600,
  },
  {
    class: "top-[17%] left-[62%] w-[26%] lg:top-[13%] lg:left-[29%] lg:w-[11%]",
    fill: "bg-sky-500",
    golden: true,
    delay: 2850,
    duration: 1300,
  },
  { class: "top-[17%] right-[9%] w-[6%] max-lg:hidden", fill: "bg-purple-500", delay: 1700, duration: 800 },
  {
    class: "bottom-[22%] right-[60%] w-[16%] lg:bottom-[27%] lg:right-[24%] lg:w-[7%]",
    fill: "bg-red-500",
    delay: 900,
    duration: 800,
  },
  {
    class: "bottom-[16%] right-[42%] w-[12%] lg:bottom-[21%] lg:right-[15%] lg:w-[5%]",
    fill: "bg-red-500",
    delay: 1750,
    duration: 600,
  },
  {
    class: "bottom-[10%] right-[8%] w-[28%] lg:bottom-[15%] lg:right-[4%] lg:w-[10%]",
    fill: "bg-red-500",
    delay: 2400,
    duration: 1400,
  },
  { class: "bottom-[12%] left-[16%] w-[8%] max-lg:hidden", fill: "bg-green-500", delay: 1300, duration: 900 },
];

/** A note bar like the game's: white outline (yellow when golden), filling in a singer's colour once. */
function NoteBar(props: { note: HeroNote }) {
  const [filled, setFilled] = createSignal(false);
  onMount(() => requestAnimationFrame(() => setFilled(true)));

  return (
    <div
      class={`absolute h-[clamp(1.6rem,2.6vw,2.6rem)] rounded-full border-[3px] p-[4px] shadow-[0_3px_0_rgb(0_0_0/0.3)] ${props.note.class}`}
      classList={{
        "border-yellow-300 bg-yellow-300/20": props.note.golden,
        "border-white bg-black/35": !props.note.golden,
      }}
    >
      <div
        class={`size-full rounded-full transition-[clip-path] ease-linear ${props.note.fill}`}
        style={{
          "clip-path": `inset(0 ${filled() ? 0 : 100}% 0 0 round 9999px)`,
          "transition-delay": `${props.note.delay}ms`,
          "transition-duration": `${props.note.duration}ms`,
        }}
      />
    </div>
  );
}

export default function Hero(props: { githubUrl: string }) {
  return (
    <section class="relative flex min-h-[100svh] items-center justify-center px-5 py-28">
      <Glow mode="title" strength={1.1} />
      <div aria-hidden="true" class="pointer-events-none absolute inset-0 animate-[rise_900ms_ease-out_200ms_both]">
        <For each={NOTES}>{(note) => <NoteBar note={note} />}</For>
      </div>

      <div class="relative mx-auto flex max-w-4xl flex-col items-center text-center">
        <h1 class="animate-[rise_700ms_ease-out_both] text-[clamp(3.2rem,9vw,7rem)] leading-[0.92] font-bold tracking-[-0.03em]">
          Tune Perfect
        </h1>
        <p class="mt-7 max-w-xl animate-[rise_700ms_ease-out_160ms_both] text-lg text-balance text-white/75 md:text-xl">
          Plug in a microphone, pick a song and see how well you sing.
        </p>
        <div class="mt-9 flex animate-[rise_700ms_ease-out_240ms_both] flex-wrap items-center justify-center gap-3">
          <Button href="#download" intent="gradient-sing" size="lg">
            <IconDownload class="text-xl" />
            Download
          </Button>
          <Button href={props.githubUrl} target="_blank" size="lg">
            <IconGithub class="text-xl" />
            GitHub
          </Button>
        </div>
        <div class="mt-6 flex animate-[rise_700ms_ease-out_320ms_both] flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm font-bold whitespace-nowrap text-white/45">
          <For each={PLATFORMS}>
            {(platform) => (
              <span class="flex items-center gap-1.5">
                <Dynamic component={platform.icon} class="text-base" />
                {platform.name}
              </span>
            )}
          </For>
          <span aria-hidden="true" class="max-sm:hidden">
            ·
          </span>
          <span>Open source</span>
        </div>
      </div>
    </section>
  );
}
