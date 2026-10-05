import { Link } from "@tanstack/solid-router";
import { createSignal, onCleanup, onMount } from "solid-js";
import IconGithub from "~icons/ph/github-logo-fill";
import IconQrCode from "~icons/ph/qr-code-bold";

import Button from "./ui/button";

interface HeaderProps {
  appUrl: string;
  githubUrl: string;
}

export default function Header(props: HeaderProps) {
  // The backdrop fades in once content scrolls under the header.
  const [scrolled, setScrolled] = createSignal(false);
  onMount(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    onCleanup(() => window.removeEventListener("scroll", update));
  });

  return (
    <header class="fixed inset-x-0 top-0 z-30">
      <div
        class="absolute inset-0 bg-black/60 backdrop-blur-xl transition-opacity duration-300"
        classList={{ "opacity-0": !scrolled() }}
      />
      <div class="relative mx-auto flex h-16 max-w-6xl items-center px-5">
        <Link to="/" class="flex items-center gap-2 text-lg font-bold">
          <img src="/favicon.svg" alt="" class="size-8" />
          Tune Perfect
        </Link>
        <div class="ml-auto flex items-center gap-2">
          <a
            href={props.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="GitHub"
            class="hidden size-10 items-center justify-center rounded-[10px] text-xl text-white/70 hover:bg-white/8 hover:text-white sm:flex"
          >
            <IconGithub />
          </a>
          <Button href={`${props.appUrl}/join`} intent="gradient-lobby" size="sm">
            <IconQrCode class="text-base" />
            Join a lobby
          </Button>
        </div>
      </div>
    </header>
  );
}
