import { createQuery } from "@tanstack/solid-query";
import { Link } from "@tanstack/solid-router";
import { Show } from "solid-js";
import IconDe from "~icons/circle-flags/de";
import IconEnUs from "~icons/circle-flags/en-us";
import IconEarth from "~icons/lucide/earth";

import { sessionQueryOptions } from "~/lib/auth";
import { setLocale, t } from "~/lib/i18n";

import NavItems from "./nav-items";
import Avatar from "./ui/avatar";
import DropdownMenu from "./ui/dropdown-menu";
export default function Header() {
  const sessionQuery = createQuery(() => sessionQueryOptions());

  return (
    <>
      <div class="h-16" />
      <header
        class="fixed top-0 right-0 left-0 z-10 bg-[rgb(16_16_36/0.55)] backdrop-blur-xl"
        style={{ "margin-right": "var(--scrollbar-width, 0px)" }}
      >
        <div class="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center justify-between gap-2 px-4">
          <div>
            <span class="text-xl font-black tracking-tight">{t("header.appName")}</span>
          </div>
          <div class="flex grow justify-center">
            <Show when={sessionQuery.data?.username}>
              <NavItems class="hidden md:flex" />
            </Show>
          </div>
          <div class="flex justify-end gap-2">
            {/* Only once the profile is set up: before that there's no profile to go to. */}
            <Show when={sessionQuery.data?.username ? sessionQuery.data : undefined}>
              {(session) => (
                <Link
                  to="/edit-profile"
                  aria-label={t("nav.profile")}
                  class="rounded-full transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
                >
                  <Avatar user={session()} />
                </Link>
              )}
            </Show>

            <DropdownMenu
              trigger={
                <DropdownMenu.Trigger class="flex size-10 cursor-pointer items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white">
                  <IconEarth class="text-xl" />
                </DropdownMenu.Trigger>
              }
            >
              <DropdownMenu.Item onSelect={() => setLocale("en")}>
                <IconEnUs /> English
              </DropdownMenu.Item>
              <DropdownMenu.Item onSelect={() => setLocale("de")}>
                <IconDe /> Deutsch
              </DropdownMenu.Item>
            </DropdownMenu>
          </div>
        </div>
      </header>
    </>
  );
}
