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
    <>

      <div class="relative flex flex-col gap-y-20 bg-slate-900 px-4 pb-20 text-white">
        <section class="relative z-2 mx-auto flex min-h-screen w-full max-w-full flex-col items-center justify-center gap-10 py-20 text-white">
          <h1 class="animate-[fadeInUp_0.6s_ease-out_forwards] text-center font-bold text-4xl opacity-0 md:text-6xl">
            Tune Perfect
          </h1>
          <p class="max-w-xl animate-[fadeInUp_0.6s_ease-out_0.2s_forwards] text-center text-white/90 text-wrap-balance opacity-0">
            Experience the ultimate karaoke game that brings the party to your living room. Perfect your pitch, compete with friends, and have
            a blast!
          </p>
          <Button
            href="#download"
            intent="gradient-sing"
            class="animate-[fadeInUp_0.6s_ease-out_0.4s_forwards] opacity-0"
          >
            Download
          </Button>
        </section>

        <section class="relative w-full">
          <img src="/images/home.png" class="relative z-2 mx-auto w-full max-w-6xl" alt="Screenshot of Tune Perfect home page" />
          <div class="pointer-events-none absolute inset-0 z-0 bg-[#1e244b] blur-[20rem]" />
        </section>

        <section class="relative z-2 mx-auto max-w-4xl px-4">
          <div class="mb-4 flex flex-col items-center gap-2">
            <h2 class="text-center font-bold text-2xl md:text-3xl">Features</h2>
            <div class="gradient-party mx-auto h-1 w-18 rounded-full bg-gradient-to-r" />
          </div>
          <div class="grid grid-cols-1 gap-8 md:grid-cols-2">
            <div class="group flex flex-col items-center gap-5 rounded-xl border border-slate-700 bg-slate-800 p-7 shadow-lg transition-transform duration-200 hover:scale-[1.03] hover:bg-slate-700 hover:shadow-2xl">
              <IconMicVocal class="mb-2 text-5xl text-slate-300 transition-colors duration-200 ease-in-out group-hover:text-cyan-400" />
              <h3 class="font-semibold text-slate-100 text-xl tracking-tight">Real-time Pitch Detection</h3>
              <p class="text-balance text-center text-slate-300 text-sm">
                Sing along and get instant feedback on your pitch accuracy and earn points along the way.
              </p>
            </div>
            <div class="group flex flex-col items-center gap-5 rounded-xl border border-slate-700 bg-slate-800 p-7 shadow-lg transition-transform duration-200 hover:scale-[1.03] hover:bg-slate-700 hover:shadow-2xl">
              <IconPartyPopper class="mb-2 text-5xl text-slate-300 transition-colors duration-200 ease-in-out group-hover:text-yellow-400" />
              <h3 class="font-semibold text-slate-100 text-xl tracking-tight">Party Mode</h3>
              <p class="text-balance text-center text-slate-300 text-sm">
                Compete with friends in exciting party modes and see who can hit the highest score!
              </p>
            </div>
            <div class="group flex flex-col items-center gap-5 rounded-xl border border-slate-700 bg-slate-800 p-7 shadow-lg transition-transform duration-200 hover:scale-[1.03] hover:bg-slate-700 hover:shadow-2xl">
              <IconUsers class="mb-2 text-5xl text-slate-300 transition-colors duration-200 ease-in-out group-hover:text-pink-500" />
              <h3 class="font-semibold text-slate-100 text-xl tracking-tight">Multiplayer Lobby</h3>
              <p class="text-balance text-center text-slate-300 text-sm">
                Join lobbies with your own account to save your progress and customize your profile.
              </p>
            </div>
            <div class="group flex flex-col items-center gap-5 rounded-xl border border-slate-700 bg-slate-800 p-7 shadow-lg transition-transform duration-200 hover:scale-[1.03] hover:bg-slate-700 hover:shadow-2xl">
              <IconSettings class="mb-2 text-5xl text-slate-300 transition-colors duration-200 ease-in-out group-hover:text-purple-500" />
              <h3 class="font-semibold text-slate-100 text-xl tracking-tight">Customizable Settings</h3>
              <p class="text-balance text-center text-slate-300 text-sm">
                Fine-tune your experience with adjustable audio, visuals, and more.
              </p>
            </div>
          </div>
        </section>

        <section class="relative mx-auto max-w-6xl px-4">
          <img src="/images/game.png" class="relative z-2 w-full" alt="Screenshot of Tune Perfect game page" />
          <div class="pointer-events-none absolute inset-0 z-0 bg-[#1e244b] blur-[20rem]" />
        </section>

        <section class="relative z-2 mx-auto flex min-h-120 max-w-5xl flex-col items-center justify-center px-4" id="download">
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
            <Button
              href="https://github.com/ZerNico/tuneperfect/"
              target="_blank"
              class="border border-slate-600 text-slate-200 hover:bg-slate-800 hover:text-white"
            >
              <IconGithub />
              GitHub
            </Button>
          </div>
        </section>
      </div>
    </>
  );
}
