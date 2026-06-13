import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { open, save } from "@tauri-apps/plugin-dialog";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { createEffect, createMemo, createSignal, For, type JSX, on } from "solid-js";
import IconDownload from "~icons/lucide/download";
import IconPlus from "~icons/lucide/plus";
import IconUpload from "~icons/lucide/upload";
import IconUser from "~icons/lucide/user";

import Layout from "~/components/layout";
import SettingsFooter from "~/components/settings-footer";
import TitleBar from "~/components/title-bar";
import Avatar from "~/components/ui/avatar";
import IconButton from "~/components/ui/icon-button";
import { createLoop } from "~/hooks/loop";
import { useNavigation } from "~/hooks/navigation";
import { t } from "~/lib/i18n";
import { playSound } from "~/lib/sound";
import { notify } from "~/lib/toast";
import { localSettings, localStore } from "~/stores/local";

export const Route = createFileRoute("/settings/local-players/")({
  component: LocalPlayersComponent,
});

function LocalPlayersComponent() {
  const [pressed, setPressed] = createSignal(false);
  const navigate = useNavigate();
  let scrollContainer: HTMLDivElement | undefined;
  const buttonRefs: (HTMLButtonElement | undefined)[] = [];

  const importScores = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [
          {
            name: "JSON",
            extensions: ["json"],
          },
        ],
      });

      if (selected) {
        const fileText = await readTextFile(selected);
        const data = JSON.parse(fileText);
        localStore.importScoresAndPlayers(data);
        notify({
          message: t("settings.sections.localPlayers.importSuccess"),
          intent: "success",
        });
      }
    } catch (error) {
      console.error("Import failed", error);
      notify({
        message: t("settings.sections.localPlayers.importFailed"),
        intent: "error",
      });
    }
  };

  const exportScores = async () => {
    try {
      const selected = await save({
        filters: [
          {
            name: "JSON",
            extensions: ["json"],
          },
        ],
        defaultPath: "tuneperfect_scores.json",
      });

      if (selected) {
        const state = localSettings();
        const exportData = {
          version: state.version,
          players: state.players,
          scores: state.scores,
        };
        await writeTextFile(selected, JSON.stringify(exportData, null, 2));
        notify({
          message: t("settings.sections.localPlayers.exportSuccess"),
          intent: "success",
        });
      }
    } catch (error) {
      console.error("Export failed", error);
      notify({
        message: t("settings.sections.localPlayers.exportFailed"),
        intent: "error",
      });
    }
  };

  const onBack = () => {
    playSound("confirm");
    navigate({ to: "/settings" });
  };

  const setButtonRef = (index: number) => (el: HTMLButtonElement) => {
    buttonRefs[index] = el;
  };

  const buttons = createMemo(() => {
    const buttons: {
      label: string;
      icon: JSX.Element;
      action?: () => void;
    }[] = [];

    for (const player of localStore.players()) {
      buttons.push({
        label: player.username,
        icon: player.image ? (
          <Avatar user={{ username: player.username, image: player.image }} class="h-24 w-24 text-3xl" />
        ) : (
          <IconUser class="text-6xl" />
        ),
        action: () =>
          navigate({
            to: "/settings/local-players/$id",
            params: {
              id: player.id,
            },
          }),
      });
    }

    buttons.push({
      label: t("settings.add"),
      icon: <IconPlus class="text-6xl" />,
      action: () => {
        navigate({
          to: "/settings/local-players/$id",
          params: {
            id: "new",
          },
        });
      },
    });

    buttons.push({
      label: t("settings.sections.localPlayers.importScores"),
      icon: <IconDownload class="text-6xl" />,
      action: importScores,
    });

    buttons.push({
      label: t("settings.sections.localPlayers.exportScores"),
      icon: <IconUpload class="text-6xl" />,
      action: exportScores,
    });

    return buttons;
  });

  const { position, increment, decrement, set } = createLoop(() => buttons().length);

  useNavigation(() => ({
    layer: 0,
    onKeydown(event) {
      if (event.action === "back") {
        onBack();
      } else if (event.action === "left") {
        decrement();
      } else if (event.action === "right") {
        increment();
      } else if (event.action === "confirm") {
        setPressed(true);
      }
    },
    onKeyup(event) {
      if (event.action === "confirm") {
        setPressed(false);
        const button = buttons()[position()];
        button?.action?.();
      }
    },
  }));

  createEffect(
    on(
      position,
      () => {
        const selectedButton = buttonRefs[position()];

        if (selectedButton && scrollContainer) {
          selectedButton.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "nearest",
          });
        }
      },
      { defer: true },
    ),
  );

  createEffect(on(position, () => playSound("select"), { defer: true }));

  return (
    <Layout
      intent="secondary"
      header={
        <TitleBar title={t("settings.title")} description={t("settings.sections.localPlayers.title")} onBack={onBack} />
      }
      footer={<SettingsFooter />}
    >
      <div class="flex w-full grow items-center justify-center gap-4">
        <div ref={scrollContainer} class="styled-scrollbars flex gap-4 overflow-y-auto py-2">
          <For each={buttons()}>
            {(button, index) => (
              <IconButton
                ref={setButtonRef(index())}
                class="shrink-0"
                onClick={() => button.action?.()}
                onMouseEnter={() => set(index())}
                selected={position() === index()}
                active={pressed() && position() === index()}
                icon={button.icon}
                label={button.label}
                gradient="gradient-settings"
              />
            )}
          </For>
        </div>
      </div>
    </Layout>
  );
}
