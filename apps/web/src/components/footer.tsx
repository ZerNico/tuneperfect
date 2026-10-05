import { Link } from "@tanstack/solid-router";
import { For, type JSX } from "solid-js";
import IconMicrophone from "~icons/ph/microphone-stage-fill";

import { PLATFORMS } from "~/lib/platform";

interface FooterProps {
  appUrl: string;
  githubUrl: string;
}

export default function Footer(props: FooterProps) {
  const linkClass = "text-white/70 hover:text-white";
  return (
    <footer class="border-t border-white/8 bg-black/30">
      <div class="mx-auto flex max-w-6xl flex-col gap-10 px-5 py-12 md:flex-row md:items-start md:justify-between">
        <div class="flex flex-col gap-2">
          <span class="flex items-center gap-2 font-bold">
            <span class="gradient-sing flex size-7 items-center justify-center rounded-[7px]">
              <IconMicrophone class="text-sm" />
            </span>
            Tune Perfect
          </span>
          <p class="max-w-xs text-sm text-white/50">An open-source karaoke game. Made by people who sing too loud.</p>
        </div>
        <div class="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3 sm:gap-16">
          <Column title="Download">
            <For each={PLATFORMS}>
              {(platform) => (
                <Link to={`/download/${platform.id}`} class={linkClass}>
                  {platform.name}
                </Link>
              )}
            </For>
          </Column>
          <Column title="Project">
            <a href={props.githubUrl} target="_blank" rel="noopener noreferrer" class={linkClass}>
              GitHub
            </a>
            <a href={`${props.appUrl}/join`} class={linkClass}>
              Join a lobby
            </a>
          </Column>
          <Column title="Legal">
            <Link to="/privacy-policy" class={linkClass}>
              Privacy Policy
            </Link>
            <Link to="/terms-of-service" class={linkClass}>
              Terms of Service
            </Link>
          </Column>
        </div>
      </div>
      <div class="mx-auto max-w-6xl px-5 pb-8 text-xs text-white/35">© {new Date().getFullYear()} Tune Perfect</div>
    </footer>
  );
}

function Column(props: { title: string; children: JSX.Element }) {
  return (
    <div class="flex flex-col gap-2">
      <span class="mb-1 text-xs font-bold tracking-widest text-white/40 uppercase">{props.title}</span>
      {props.children}
    </div>
  );
}
