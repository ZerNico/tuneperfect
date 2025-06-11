import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { exit } from "@tauri-apps/plugin-process";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";

export const Route = createFileRoute("/quit")({
  component: QuitComponent,
});

function QuitComponent() {
  const navigate = useNavigate();

  const closeGame = async () => {
    await exit();
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
      <div class="grid flex-grow grid-rows-[1fr_2fr]">
        <div class="flex items-end justify-center">
          <div class="font-bold text-3xl">{t("quit.message")}</div>
        </div>
        <Menu items={menuItems} onBack={onBack} />
      </div>
    </Layout>
  );
}
