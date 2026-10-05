import { Link, type LinkProps } from "@tanstack/solid-router";
import { type JSX, Show } from "solid-js";
import IconCaretLeft from "~icons/ph/caret-left-bold";

import Tag from "./ui/tag";

interface PageHeaderProps {
  title: JSX.Element;
  /** White tag next to the title, e.g. the lobby code or a count. */
  tag?: JSX.Element;
  /** A line under the title: status, description. */
  subtitle?: JSX.Element;
  back?: { to: LinkProps["to"]; label: JSX.Element };
  /** Shown on the right, e.g. a refresh button. */
  action?: JSX.Element;
}

export default function PageHeader(props: PageHeaderProps) {
  return (
    <header class="flex flex-col gap-2 pt-2 pb-5">
      <Show when={props.back}>
        {(back) => (
          <Link
            to={back().to}
            class="-ml-1 flex items-center gap-1 self-start py-1 text-[15px] font-bold text-white/60 transition-colors hover:text-white"
          >
            <IconCaretLeft />
            {back().label}
          </Link>
        )}
      </Show>
      <div class="flex items-center gap-3">
        <h1 class="text-[34px] leading-none font-bold text-box-cap">{props.title}</h1>
        <Show when={props.tag}>
          <Tag class="text-[13px]">{props.tag}</Tag>
        </Show>
        <Show when={props.action}>
          <div class="ml-auto">{props.action}</div>
        </Show>
      </div>
      <Show when={props.subtitle}>
        <div class="text-[15px] text-white/60">{props.subtitle}</div>
      </Show>
    </header>
  );
}
