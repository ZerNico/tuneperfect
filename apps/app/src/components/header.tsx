import { safe } from "@orpc/client";
import { createQuery } from "@tanstack/solid-query";
import { useNavigate } from "@tanstack/solid-router";
import { Show } from "solid-js";
import IconDe from "~icons/circle-flags/de";
import IconEnUs from "~icons/circle-flags/en-us";
import IconEarth from "~icons/lucide/earth";
import IconLogOut from "~icons/lucide/log-out";
import IconUser from "~icons/lucide/user";

import { sessionQueryOptions } from "~/lib/auth";
import { setLocale, t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { notify } from "~/lib/toast";
import { queryClient } from "~/main";

import NavItems from "./nav-items";
import Avatar from "./ui/avatar";
import DropdownMenu from "./ui/dropdown-menu";
export default function Header() {
  const sessionQuery = createQuery(() => sessionQueryOptions());

  const navigate = useNavigate();

  const logout = async () => {
    const [error, _data, _isDefined] = await safe(client.auth.signOut.call());

    if (error) {
      notify({
        message: t("error.unknown"),
        intent: "error",
      });

      return;
    }

    await queryClient.resetQueries();
    await navigate({ to: "/sign-in" });
  };

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
            <Show when={sessionQuery.data}>
              <NavItems class="hidden md:flex" />
            </Show>
          </div>
          <div class="flex justify-end gap-2">
            <Show when={sessionQuery.data}>
              {(session) => (
                <DropdownMenu
                  trigger={
                    <DropdownMenu.Trigger class="cursor-pointer rounded-full transition-opacity hover:opacity-75 focus-visible:outline-2 focus-visible:outline-white">
                      <Avatar class="rounded-full" user={session()} />
                    </DropdownMenu.Trigger>
                  }
                >
                  <DropdownMenu.Item onSelect={() => navigate({ to: "/edit-profile" })}>
                    <IconUser /> {t("header.editProfile")}
                  </DropdownMenu.Item>
                  <DropdownMenu.Item onSelect={logout}>
                    <IconLogOut /> {t("header.signOut")}
                  </DropdownMenu.Item>
                </DropdownMenu>
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
