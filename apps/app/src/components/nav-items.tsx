import { useQuery } from "@tanstack/solid-query";
import { Link, type LinkProps } from "@tanstack/solid-router";
import { Show, type Component, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import IconUser from "~icons/lucide/user";
import IconUserPlus from "~icons/lucide/user-plus";
import IconUsers from "~icons/lucide/users";
import IconUsersRound from "~icons/lucide/users-round";

import { sessionQueryOptions } from "~/lib/auth";
import { t } from "~/lib/i18n";

interface NavItemsProps {
  class?: string;
}

export default function NavItems(props: NavItemsProps) {
  const sessionQuery = useQuery(() => sessionQueryOptions());

  return (
    <nav
      class="grid place-items-center"
      style={{ "grid-auto-flow": "column", "grid-auto-columns": "1fr" }}
      classList={{
        [props.class || ""]: true,
      }}
    >
      <NavItem to="/clubs" icon={IconUsersRound}>
        {t("nav.clubs")}
      </NavItem>
      <Show
        when={sessionQuery.data?.lobbyId !== null}
        fallback={
          <NavItem to="/join" icon={IconUserPlus}>
            {t("nav.join")}
          </NavItem>
        }
      >
        <NavItem to="/" icon={IconUsers}>
          {t("nav.lobby")}
        </NavItem>
      </Show>

      <NavItem to="/edit-profile" icon={IconUser}>
        {t("nav.profile")}
      </NavItem>
    </nav>
  );
}

interface NavItemProps {
  to: LinkProps["to"];
  icon: Component<{ class?: string }>;
  children: JSX.Element;
}

function NavItem(props: NavItemProps) {
  return (
    <Link draggable={false} to={props.to} class="relative w-full rounded-md px-3 select-none hover:bg-white/10">
      {({ isActive }) => (
        <>
          <div class="flex flex-col items-center py-2 break-keep whitespace-nowrap md:flex-row md:gap-2">
            <Dynamic component={props.icon} />
            {props.children}
          </div>
          <div
            class="absolute right-0 bottom-0 left-0 px-3 transition-opacity"
            classList={{
              "opacity-0": !isActive,
            }}
          >
            <div class="h-1 w-full rounded-full bg-white" />
          </div>
        </>
      )}
    </Link>
  );
}
