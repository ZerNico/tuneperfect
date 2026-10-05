import { Link } from "@tanstack/solid-router";
import { For, type JSX } from "solid-js";
import IconCaretLeft from "~icons/ph/caret-left-bold";

import Glow from "~/components/glow";

interface PlatformPageProps {
  icon: JSX.Element;
  title: string;
  subtitle: string;
  children: JSX.Element;
}

/** Shared frame of the per-platform download pages. */
export default function PlatformPage(props: PlatformPageProps) {
  return (
    <div class="relative mx-auto max-w-5xl px-5 pt-28 pb-24">
      <Glow mode="settings" class="-inset-x-[30%] top-0 h-[40rem]" strength={0.8} />
      <Link
        to="/"
        hash="download"
        class="mb-8 inline-flex items-center gap-2 text-sm font-bold text-white/60 hover:text-white"
      >
        <span class="flex size-7 items-center justify-center rounded-full bg-white/10">
          <IconCaretLeft />
        </span>
        All platforms
      </Link>
      <div class="mb-10 flex items-center gap-5">
        <span class="gradient-settings flex size-16 shrink-0 items-center justify-center rounded-[16px] text-4xl shadow-crisp">
          {props.icon}
        </span>
        <div>
          <h1 class="text-4xl font-bold md:text-5xl">{props.title}</h1>
          <p class="mt-1 text-white/60">{props.subtitle}</p>
        </div>
      </div>
      <div class="flex flex-col gap-6">{props.children}</div>
    </div>
  );
}

/** A plain surface block for instructions and requirements. */
export function InfoPanel(props: { title: string; children: JSX.Element }) {
  return (
    <section class="rounded-[16px] bg-white/5 p-6">
      <h2 class="mb-4 text-xl font-bold">{props.title}</h2>
      <div class="flex flex-col gap-4 text-white/70">{props.children}</div>
    </section>
  );
}

export function Requirements(props: { items: string[] }) {
  return (
    <ul class="list-disc space-y-1.5 pl-5 marker:text-white/40">
      <For each={props.items}>{(item) => <li>{item}</li>}</For>
    </ul>
  );
}
