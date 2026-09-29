import { useNavigate } from "@tanstack/solid-router";
import IconSword from "~icons/ph/sword-fill";

import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import ModeCardRow, { type ModeCardItem } from "~/components/mode-card-row";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";
import { playSound } from "~/lib/sound";

/** Board with an X and an O, drawn solid like the Phosphor Fill icons. */
function IconTicTacToe(props: { class?: string }) {
  return (
    <svg viewBox="0 0 256 256" width="1em" height="1em" class={props.class} fill="currentColor" aria-hidden="true">
      <rect x="84" y="16" width="20" height="224" rx="10" />
      <rect x="152" y="16" width="20" height="224" rx="10" />
      <rect x="16" y="84" width="224" height="20" rx="10" />
      <rect x="16" y="152" width="224" height="20" rx="10" />
      <path
        d="M30 30 L60 60 M60 30 L30 60"
        stroke="currentColor"
        stroke-width="16"
        stroke-linecap="round"
        fill="none"
      />
      <circle cx="128" cy="128" r="16" stroke="currentColor" stroke-width="14" fill="none" />
      <path
        d="M196 196 L226 226 M226 196 L196 226"
        stroke="currentColor"
        stroke-width="16"
        stroke-linecap="round"
        fill="none"
      />
    </svg>
  );
}

export default function PartyScreen() {
  const navigate = useNavigate();
  const onBack = () => navigate({ to: "/home" });

  const cards: ModeCardItem[] = [
    {
      label: t("party.versus.title"),
      gradient: "gradient-party",
      icon: IconSword,
      description: t("party.versusDescription"),
      action: () => {
        navigate({ to: "/party/versus/settings" });
        playSound("confirm");
      },
    },
    {
      label: t("party.ticTacToe.title"),
      gradient: "gradient-party",
      icon: IconTicTacToe,
      description: t("party.ticTacToeDescription"),
      action: () => {
        navigate({ to: "/party/tic-tac-toe/settings" });
        playSound("confirm");
      },
    },
  ];

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title={t("party.title")} onBack={onBack} />}
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <div class="flex h-full items-center">
        <ModeCardRow class="h-[62cqh] w-full" cards={cards} onBack={onBack} />
      </div>
    </Layout>
  );
}
