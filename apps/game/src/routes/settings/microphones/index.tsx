import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { createEffect, createMemo, createSignal, For, type JSX, on } from "solid-js";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import TitleBar from "~/components/title-bar";
import IconButton from "~/components/ui/icon-button";
import { createLoop } from "~/hooks/loop";
import { useNavigation } from "~/hooks/navigation";
import { t } from "~/lib/i18n";
import { playSound } from "~/lib/sound";
import { settingsStore } from "~/stores/settings";
import IconMicVocal from "~icons/lucide/mic-vocal";
import IconPlus from "~icons/lucide/plus";

export const Route = createFileRoute("/settings/microphones/")({
  component: MicrophonesComponent,
});

function MicrophonesComponent() {
  const [pressed, setPressed] = createSignal(false);

  const navigate = useNavigate();
  const onBack = () => {
    playSound("confirm");
    navigate({ to: "/settings" });
  };

  const buttons = createMemo(() => {
    const buttons: {
      label: string;
      icon: JSX.Element;
      action?: () => void;
    }[] = [];

    for (const [index, microphone] of settingsStore.microphones().entries()) {
      buttons.push({
        label: microphone.name,
        icon: <IconMicVocal class="text-6xl" />,
        action: () => {
          navigate({ to: "/settings/microphones/$id", params: { id: index.toString() } });
        },
      });
    }

    if (settingsStore.microphones().length < 2) {
      buttons.push({
        label: t("settings.add"),
        icon: <IconPlus class="text-6xl" />,
        action: () => {
          navigate({ to: "/settings/microphones/$id", params: { id: settingsStore.microphones().length.toString() } });
        },
      });
    }

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
        playSound("confirm");
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

  createEffect(on(position, () => playSound("select"), { defer: true }));

  return (
    <Layout
      intent="secondary"
      header={
        <TitleBar title={t("settings.title")} description={t("settings.sections.microphones.title")} onBack={onBack} />
      }
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <div class="flex w-full flex-grow items-center justify-center gap-4">
        <For each={buttons()}>
          {(button, index) => (
            <IconButton
              onClick={() => {
                button.action?.();
                playSound("confirm");
              }}
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
    </Layout>
  );
}
