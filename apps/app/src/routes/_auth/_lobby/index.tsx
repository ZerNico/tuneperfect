import { createFileRoute, Link } from "@tanstack/solid-router";
import type { Component } from "solid-js";
import { Dynamic } from "solid-js/web";
import { t } from "~/lib/i18n";
import IconMusic from "~icons/lucide/music";
import IconUsers from "~icons/lucide/users";

export const Route = createFileRoute("/_auth/_lobby/")({
  component: LobbyMainComponent,
});

function LobbyMainComponent() {
  const cards = [
    {
      label: t("lobby.playersTitle"),
      description: t("lobby.playersDescription"),
      gradient: "gradient-lobby",
      icon: IconUsers,
      to: "/players" as const,
    },
    {
      label: t("lobby.songsTitle"),
      description: t("lobby.songsDescription"),
      gradient: "gradient-sing",
      icon: IconMusic,
      to: "/songs" as const,
    },
  ];

  return (
    <div class="container mx-auto flex w-full flex-grow flex-col p-4 sm:max-w-4xl">
      <div class="mb-6">
        <h1 class="font-bold text-3xl">{t("lobby.title")}</h1>
      </div>

      <div class="flex flex-col gap-4">
        {cards.map((card) => (
          <LobbyCard
            label={card.label as string}
            description={card.description as string}
            gradient={card.gradient}
            icon={card.icon}
            to={card.to}
          />
        ))}
      </div>
    </div>
  );
}

interface LobbyCardProps {
  label: string;
  description: string;
  gradient: string;
  icon: Component<{ class?: string }>;
  to: "/players" | "/songs";
}

function LobbyCard(props: LobbyCardProps) {
  return (
    <Link
      to={props.to}
      class="group flex cursor-pointer overflow-hidden rounded-xl bg-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]"
    >
      <div
        class="flex w-24 flex-shrink-0 items-center justify-center bg-gradient-to-br p-4"
        classList={{
          [props.gradient]: true,
        }}
      >
        <Dynamic component={props.icon} class="h-10 w-10 text-white" />
      </div>
      <div class="flex flex-grow flex-col justify-center p-4">
        <div class="font-semibold text-lg text-slate-800">{props.label}</div>
        <div class="text-slate-500 text-sm">{props.description}</div>
      </div>
    </Link>
  );
}
