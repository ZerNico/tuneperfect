import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createSignal } from "solid-js";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import type { MenuItem } from "~/components/menu";
import Menu from "~/components/menu";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";
import { settingsStore } from "~/stores/settings";
import IconDe from "~icons/circle-flags/de";
import IconEnUs from "~icons/circle-flags/en-us";

export const Route = createFileRoute("/settings/general/")({
  component: GeneralSettingsComponent,
});

function GeneralSettingsComponent() {
  const navigate = useNavigate();
  const onBack = () => {
    navigate({ to: "/settings" });
  };

  const [general, setGeneral] = createSignal(settingsStore.general());

  const saveGeneral = () => {
    settingsStore.saveGeneral(general());
    onBack();
  };

  const menuItems: MenuItem[] = [
    {
      type: "select-string",
      label: t("settings.sections.general.language"),
      value: () => general().language,
      options: ["en", "de"],
      onChange: (value) => setGeneral({ ...general(), language: value }),
      renderValue: () => {
        if (general().language === "en") {
          return <IconEnUs />;
        }
        if (general().language === "de") {
          return <IconDe />;
        }
      },
    },
    {
      type: "select-string",
      label: t("settings.sections.general.forceOfflineMode"),
      value: () => (general().forceOfflineMode ? t("common.yes") : t("common.no")),
      options: [t("common.no"), t("common.yes")],
      onChange: (value) => setGeneral({ ...general(), forceOfflineMode: value === t("common.yes") }),
    },
    {
      type: "button",
      label: t("settings.save"),
      action: saveGeneral,
    },
  ];

  return (
    <Layout
      intent="secondary"
      header={
        <TitleBar title={t("settings.title")} description={t("settings.sections.general.title")} onBack={onBack} />
      }
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <Menu items={menuItems} onBack={onBack} />
    </Layout>
  );
}
