import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { type Component, For, createMemo, createSignal } from "solid-js";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import TitleBar from "~/components/title-bar";
import IconButton from "~/components/ui/icon-button";
import { createLoop } from "~/hooks/loop";
import { useNavigation } from "~/hooks/navigation";
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
    navigate({ to: "/settings" });
  };

  const buttons = createMemo(() => {
    const buttons: {
      label: string;
      icon: Component<{ class?: string }>;
      action?: () => void;
    }[] = [];

    for (const [index, microphone] of settingsStore.microphones().entries()) {
      buttons.push({
        label: microphone.name,
        icon: IconMicVocal,
        action: () => {
          navigate({ to: "/settings/microphones/$id", params: { id: index.toString() } });
        },
      });
    }

    buttons.push({
      label: "Add",
      icon: IconPlus,
      action: () => {
        navigate({ to: "/settings/microphones/$id", params: { id: settingsStore.microphones().length.toString() } });
      },
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

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title="Settings" description="Microphones" onBack={onBack} />}
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <div class="flex w-full flex-grow items-center justify-center gap-4">
        <For each={buttons()}>
          {(button, index) => (
            <IconButton
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
    </Layout>
  );
}
