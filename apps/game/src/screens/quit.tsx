import { useNavigate } from "@tanstack/solid-router";

import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";
import { native } from "~/lib/native/client";

export default function QuitScreen() {
  const navigate = useNavigate();

  const closeGame = async () => {
    await native.app.exit();
  };

  const onBack = () => {
    navigate({ to: "/home" });
  };

  const menuItems: MenuItem[] = [
    {
      type: "button",
      label: t("common.no"),
      action: () => navigate({ to: "/home" }),
    },
    {
      type: "button",
      label: t("common.yes"),
      action: closeGame,
    },
  ];

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title={t("quit.title")} onBack={onBack} />}
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <div class="grid grow grid-rows-[1fr_2fr]">
        <div class="flex items-end justify-center">
          <div class="text-center text-5xl font-bold">{t("quit.message")}</div>
        </div>
        <Menu items={menuItems} onBack={onBack} />
      </div>
    </Layout>
  );
}
