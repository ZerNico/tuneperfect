import { Link } from "@tanstack/solid-router";
import { For, Show } from "solid-js";
import { Dynamic } from "solid-js/web";
import IconDownload from "~icons/ph/download-simple-bold";
import IconGithub from "~icons/ph/github-logo-fill";

import DownloadButton from "~/components/download-button";
import Glow from "~/components/glow";
import { PLATFORMS, usePlatform } from "~/lib/platform";

import Reveal from "./reveal";

/** The closing call: the visitor's platform selected like a menu card. */
export default function Download(props: { version?: string; githubUrl: string }) {
  const current = usePlatform();

  return (
    <section id="download" class="relative scroll-mt-16 px-5 py-24 md:py-32">
      <Glow mode="sing" strength={0.9} />
      <Reveal class="relative mx-auto max-w-6xl">
        <div class="relative flex flex-col items-center text-center">
          <h2 class="mt-6 text-[clamp(2.75rem,8vw,6.5rem)] leading-[0.92] font-bold tracking-[-0.03em]">
            Get Tune Perfect
          </h2>
          <p class="mt-6 max-w-lg text-lg text-balance text-white/75">For Windows, macOS and Linux.</p>
          <div class="mt-9">
            <DownloadButton />
          </div>

          <div class="mt-12 grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
            <For each={PLATFORMS}>
              {(platform) => {
                const mine = () => current().id === platform.id;
                return (
                  <Link
                    to={`/download/${platform.id}`}
                    class="group relative flex items-center gap-3 overflow-hidden rounded-[14px] p-4 text-left ring-2 shadow-crisp transition-[background-color,box-shadow] duration-200 sm:flex-col sm:items-start"
                    classList={{
                      "gradient-sing ring-white": mine(),
                      "bg-[rgb(28_28_56)] ring-transparent hover:bg-[rgb(36_36_70)] hover:ring-white/40": !mine(),
                    }}
                  >
                    <Show when={mine()}>
                      <div class="absolute inset-0 stripes" />
                    </Show>
                    <Dynamic component={platform.icon} class="relative text-3xl" />
                    <div class="relative flex min-w-0 grow flex-col">
                      <span class="flex items-center gap-2 font-bold">
                        {platform.name}
                        <IconDownload class="text-sm opacity-60" />
                      </span>
                      <span class="text-sm" classList={{ "text-white/90": mine(), "text-white/50": !mine() }}>
                        {platform.detail}
                      </span>
                    </div>
                  </Link>
                );
              }}
            </For>
          </div>

          <div class="mt-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm font-bold text-white/50">
            <Show when={props.version}>
              <span>Version {props.version}</span>
              <span aria-hidden="true">·</span>
            </Show>
            <a
              href={props.githubUrl}
              target="_blank"
              rel="noopener noreferrer"
              class="flex items-center gap-1.5 hover:text-white"
            >
              <IconGithub class="text-base" /> Source on GitHub
            </a>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
