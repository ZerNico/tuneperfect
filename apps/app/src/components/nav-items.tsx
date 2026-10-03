import { useQuery } from "@tanstack/solid-query";
import { Link, type LinkProps, useLocation } from "@tanstack/solid-router";
import { type Component, For, type JSX } from "solid-js";
import { Dynamic } from "solid-js/web";
import IconMicrophone from "~icons/ph/microphone-stage-fill";
import IconUserCircle from "~icons/ph/user-circle-fill";
import IconUsersThree from "~icons/ph/users-three-fill";

import { sessionQueryOptions } from "~/lib/auth";
import { t } from "~/lib/i18n";

interface NavItemsProps {
  class?: string;
}

interface Tab {
  to: LinkProps["to"];
  label: () => string;
  icon: Component<{ class?: string }>;
  /** Also active on these sub-pages, so the tab stays marked deeper in the section. */
  matches: (pathname: string) => boolean;
}

export default function NavItems(props: NavItemsProps) {
  const sessionQuery = useQuery(() => sessionQueryOptions());
  const location = useLocation();

  const tabs = (): Tab[] => [
    {
      // The lobby tab leads to joining while you're not in one.
      to: sessionQuery.data?.lobbyId ? "/" : "/join",
      label: () => t("nav.lobby"),
      icon: IconMicrophone,
      matches: (path) => path === "/" || path === "/players" || path === "/songs" || path.startsWith("/join"),
    },
    {
      to: "/clubs",
      label: () => t("nav.clubs"),
      icon: IconUsersThree,
      matches: (path) => path.startsWith("/clubs"),
    },
    {
      to: "/edit-profile",
      label: () => t("nav.profile"),
      icon: IconUserCircle,
      matches: (path) => path === "/edit-profile" || path === "/change-password",
    },
  ];

  return (
    <nav class={`grid auto-cols-fr grid-flow-col ${props.class ?? ""}`}>
      <For each={tabs()}>
        {(tab) => (
          <NavItem to={tab.to} icon={tab.icon} active={tab.matches(location().pathname)}>
            {tab.label()}
          </NavItem>
        )}
      </For>
    </nav>
  );
}

interface NavItemProps {
  to: LinkProps["to"];
  icon: Component<{ class?: string }>;
  active: boolean;
  children: JSX.Element;
}

function NavItem(props: NavItemProps) {
  return (
    <Link
      draggable={false}
      to={props.to}
      aria-current={props.active ? "page" : undefined}
      class="group flex flex-col items-center gap-1 px-2 py-1 select-none md:flex-row md:gap-2"
    >
      <span
        class="flex h-8 w-14 items-center justify-center rounded-[10px] text-[22px] transition-colors md:h-9 md:w-auto md:gap-2 md:px-3 md:text-xl"
        classList={{
          "gradient-accent text-white": props.active,
          "text-white/45 group-hover:text-white/80": !props.active,
        }}
      >
        <Dynamic component={props.icon} />
        <span class="hidden text-base font-bold md:inline">{props.children}</span>
      </span>
      <span
        class="text-[11px] font-bold whitespace-nowrap md:hidden"
        classList={{ "text-white": props.active, "text-white/45": !props.active }}
      >
        {props.children}
      </span>
    </Link>
  );
}
