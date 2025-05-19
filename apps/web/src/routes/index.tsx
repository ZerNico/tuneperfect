import { createFileRoute } from "@tanstack/solid-router";
import Button from "~/components/ui/button";
import IconApple from "~icons/logos/apple";
import IconWindows from "~icons/logos/microsoft-windows-icon";
import IconGithub from "~icons/lucide/github";
import IconMicVocal from "~icons/lucide/mic-vocal";
import IconPartyPopper from "~icons/lucide/party-popper";
import IconSettings from "~icons/lucide/settings";
import IconUsers from "~icons/lucide/users";
import IconLinux from "~icons/sing/linux";

export const Route = createFileRoute("/")({
  component: RouteComponent,
});

function RouteComponent() {
  return (
    <div class="relative flex flex-col gap-20 p-4 pb-20">
      <section class="relative z-2 mx-auto flex min-h-[calc(50dvh-4rem)] max-w-6xl flex-col items-center justify-center gap-10">
        <h1 class=" text-center font-bold text-4xl md:text-5xl">Tune Perfect</h1>
        <p class="max-w-120 text-center text-wrap-balance">
          Experience the ultimate karaoke game that brings the party to your living room. Perfect your pitch, compete with friends, and have
          a blast!
        </p>
        <Button href="#download" intent="gradient-sing">
          Download
        </Button>
      </section>

      <section class="relative mx-auto max-w-6xl px-4">
        <img src="/images/home.png" class="relative z-2 w-full" alt="Screenshot of Tune Perfect home page" />
        <div class="pointer-events-none absolute inset-0 z-0 bg-[#1e244b] blur-[20rem]" />
      </section>

      <section class="relative z-2 mx-auto max-w-4xl shadow-xl">
        <div class="mb-4 flex flex-col items-center gap-2">
          <h2 class="text-center font-bold text-2xl md:text-3xl">Features</h2>
          <div class="gradient-party mx-auto h-1 w-18 rounded-full bg-gradient-to-r" />
        </div>
        <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
          <div class="group flex flex-col items-center gap-5 rounded-xl border border-black/10 bg-white/90 p-7 text-black shadow-lg transition-transform duration-200 hover:scale-[1.03] hover:bg-white hover:shadow-2xl">
            <IconMicVocal class="mb-2 text-5xl text-black transition-colors duration-200 ease-in-out group-hover:text-cyan-400" />
            <h3 class="font-semibold text-xl tracking-tight">Real-time Pitch Detection</h3>
            <p class="text-balance text-center text-black/80 text-sm">
              Sing along and get instant feedback on your pitch accuracy and earn points along the way.
            </p>
          </div>
          <div class="group flex flex-col items-center gap-5 rounded-xl border border-black/10 bg-white/90 p-7 text-black shadow-lg transition-transform duration-200 hover:scale-[1.03] hover:bg-white hover:shadow-2xl">
            <IconPartyPopper class="mb-2 text-5xl text-black transition-colors duration-200 ease-in-out group-hover:text-yellow-400" />
            <h3 class="font-semibold text-xl tracking-tight">Party Mode</h3>
            <p class="text-balance text-center text-black/80 text-sm">
              Compete with friends in exciting party modes and see who can hit the highest score!
            </p>
          </div>
          <div class="group flex flex-col items-center gap-5 rounded-xl border border-black/10 bg-white/90 p-7 text-black shadow-lg transition-transform duration-200 hover:scale-[1.03] hover:bg-white hover:shadow-2xl">
            <IconUsers class="mb-2 text-5xl text-black transition-colors duration-200 ease-in-out group-hover:text-pink-500" />
            <h3 class="font-semibold text-xl tracking-tight">Multiplayer Lobby</h3>
            <p class="text-balance text-center text-black/80 text-sm">
              Join lobbies with your own account to save your progress and customize your profile.
            </p>
          </div>
          <div class="group flex flex-col items-center gap-5 rounded-xl border border-black/10 bg-white/90 p-7 text-black shadow-lg transition-transform duration-200 hover:scale-[1.03] hover:bg-white hover:shadow-2xl">
            <IconSettings class="mb-2 text-5xl text-black transition-colors duration-200 ease-in-out group-hover:text-purple-500" />
            <h3 class="font-semibold text-xl tracking-tight">Customizable Settings</h3>
            <p class="text-balance text-center text-black/80 text-sm">
              Fine-tune your experience with adjustable audio, visuals, and more.
            </p>
          </div>
        </div>
      </section>

      <section class="relative mx-auto max-w-6xl px-4">
        <img src="/images/game.png" class="relative z-2 w-full" alt="Screenshot of Tune Perfect game page" />
        <div class="pointer-events-none absolute inset-0 z-0 bg-[#1e244b] blur-[20rem]" />
      </section>

      <section class="relative z-2 mx-auto max-w-5xl px-4" id="download">
        <div class="mb-4 flex flex-col items-center gap-2">
          <h2 class="text-center font-bold text-2xl md:text-3xl">Download</h2>
          <div class="gradient-settings mx-auto h-1 w-18 rounded-full bg-gradient-to-r" />
        </div>
        <p class="mb-8 text-center text-white/80">Choose your platform and get started.</p>
        <div class="flex flex-wrap items-center justify-center gap-4">
          <Button intent="gradient-settings">
            <IconApple class="invert" />
            <span class="font-semibold">
              macOS <span class="text-xs">(Apple Silicon)</span>
            </span>
          </Button>
          <Button intent="gradient-settings">
            <IconApple class="invert" />
            <span class="font-semibold">
              macOS <span class="text-xs">(Intel)</span>
            </span>
          </Button>
          <Button intent="gradient-settings">
            <IconWindows class="brightness-1000" />
            <span class="font-semibold">Windows</span>
          </Button>
          <Button intent="gradient-settings">
            <IconLinux class="brightness-1000" />
            <span class="font-semibold">Linux</span>
          </Button>
          <Button href="https://github.com/ZerNico/tuneperfect/" target="_blank">
            <IconGithub />
            GitHub
          </Button>
        </div>
      </section>
    </div>
  );
}
