import { safe } from "@orpc/client";
import { createQuery } from "@tanstack/solid-query";
import { useNavigate } from "@tanstack/solid-router";
import { Show } from "solid-js";
import { sessionQueryOptions } from "~/lib/auth";
import { setLocale, t } from "~/lib/i18n";
import { client } from "~/lib/orpc";
import { notify } from "~/lib/toast";
import { tryCatch } from "~/lib/utils/try-catch";
import { queryClient } from "~/main";
import IconDe from "~icons/circle-flags/de";
import IconEnUs from "~icons/circle-flags/en-us";
import IconBan from "~icons/lucide/ban";
import IconEarth from "~icons/lucide/earth";
import IconLogOut from "~icons/lucide/log-out";
import IconUser from "~icons/lucide/user";
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

    queryClient.clear();
    await navigate({ to: "/sign-in" });
  };

  const leaveLobby = async () => {
    const [_data, error] = await tryCatch(client.lobby.leaveLobby.call());

    if (error) {
      notify({
        message: t("error.unknown"),
        intent: "error",
      });
      return;
    }

    await queryClient.invalidateQueries(sessionQueryOptions());
    await queryClient.invalidateQueries(client.lobby.currentLobby.queryOptions());
    await navigate({ to: "/join" });
  };

  return (
    <>
      <div class="h-16" />
      <header class="fixed top-0 right-0 left-0 border-white/10 border-b">
        <div class="mx-auto grid h-16 max-w-6xl grid-cols-[1fr_auto_1fr] items-center justify-between gap-2 px-4">
          <div>
            <span class="font-bold text-lg">{t("header.app_name")}</span>
          </div>
          <div class="flex flex-grow justify-center">
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
                  <DropdownMenu.Item onClick={() => navigate({ to: "/edit-profile" })}>
                    <IconUser /> {t("header.edit_profile")}
                  </DropdownMenu.Item>
                  <Show when={session().lobbyId !== null}>
                    <DropdownMenu.Item onClick={leaveLobby}>
                      <IconBan /> {t("header.leave_lobby")}
                    </DropdownMenu.Item>
                  </Show>
                  <DropdownMenu.Item onClick={logout}>
                    <IconLogOut /> {t("header.sign_out")}
                  </DropdownMenu.Item>
                </DropdownMenu>
              )}
            </Show>

            <DropdownMenu
              trigger={
                <DropdownMenu.Trigger class="cursor-pointer rounded-full p-2 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white">
                  <IconEarth class="text-lg" />
                </DropdownMenu.Trigger>
              }
            >
              <DropdownMenu.Item onClick={() => setLocale("en")}>
                <IconEnUs /> English
              </DropdownMenu.Item>
              <DropdownMenu.Item onClick={() => setLocale("en")}>
                <IconDe /> Deutsch
              </DropdownMenu.Item>
            </DropdownMenu>
          </div>
        </div>
      </header>
    </>
  );
}
