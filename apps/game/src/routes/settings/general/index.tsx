import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createSignal } from "solid-js";
import IconDe from "~icons/circle-flags/de";
import IconEnUs from "~icons/circle-flags/en-us";

import LatencyCalibrationPreview from "~/components/latency-calibration-preview";
import Layout from "~/components/layout";
import type { MenuItem } from "~/components/menu";
import Menu from "~/components/menu";
import SettingsFooter from "~/components/settings-footer";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";
import { settingsStore } from "~/stores/settings";

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
      renderValue: () => (general().language === "en" ? <IconEnUs /> : general().language === "de" ? <IconDe /> : null),
    },
    {
      type: "select-string",
      label: t("settings.sections.general.forceOfflineMode"),
      value: () => (general().forceOfflineMode ? "yes" : "no"),
      options: ["yes", "no"],
      onChange: (value) => setGeneral({ ...general(), forceOfflineMode: value === "yes" }),
      renderValue: (value) => t(`common.${value as "yes" | "no"}`),
    },
    {
      type: "select-string",
      label: t("settings.sections.general.showNoteSegments"),
      value: () => (general().showNoteSegments ? "yes" : "no"),
      options: ["no", "yes"],
      onChange: (value) => setGeneral({ ...general(), showNoteSegments: value === "yes" }),
      renderValue: (value) => t(`common.${value as "yes" | "no"}`),
    },
    {
      type: "select-string",
      label: t("settings.sections.general.difficulty"),
      value: () => general().difficulty,
      options: ["easy", "medium", "hard"],
      onChange: (value) => setGeneral({ ...general(), difficulty: value as "easy" | "medium" | "hard" }),
      renderValue: (value) => t(`settings.sections.general.difficultyOptions.${value as "easy" | "medium" | "hard"}`),
    },
    {
      type: "select-string",
      label: t("settings.sections.general.audioMode"),
      value: () => general().audioMode,
      options: ["normal", "preferInstrumental"],
      onChange: (value) => setGeneral({ ...general(), audioMode: value as "normal" | "preferInstrumental" }),
      renderValue: (value) =>
        t(`settings.sections.general.audioModeOptions.${value as "normal" | "preferInstrumental"}`),
    },
    {
      type: "select-string",
      label: t("settings.sections.volume.micPlayback"),
      value: () => (general().micPlaybackEnabled ? "yes" : "no"),
      options: ["yes", "no"],
      onChange: (value) => setGeneral({ ...general(), micPlaybackEnabled: value === "yes" }),
      renderValue: (value) => t(`common.${value as "yes" | "no"}`),
    },
    {
      type: "select-string",
      label: t("settings.sections.general.songSelectStyle"),
      value: () => general().songSelectStyle,
      options: ["coverflow", "grid"],
      onChange: (value) => setGeneral({ ...general(), songSelectStyle: value as "coverflow" | "grid" }),
      renderValue: (value) => t(`settings.sections.general.songSelectStyleOptions.${value as "coverflow" | "grid"}`),
    },
    {
      type: "slider",
      label: t("settings.sections.general.outputLatency"),
      value: () => general().outputLatency,
      min: -750,
      max: 750,
      step: 10,
      onInput: (value) => setGeneral({ ...general(), outputLatency: value }),
      renderValue: (value) => `${value > 0 ? "+" : ""}${value} ms`,
    },
    {
      type: "custom",
      render: (ctx) => (
        <LatencyCalibrationPreview
          outputLatency={() => general().outputLatency}
          selected={ctx.selected}
          gradient={ctx.gradient}
        />
      ),
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
      footer={<SettingsFooter />}
    >
      <Menu items={menuItems} onBack={onBack} />
    </Layout>
  );
}
