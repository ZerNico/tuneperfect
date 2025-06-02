import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { type Component, For, createEffect, createMemo, createSignal, on } from "solid-js";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import TitleBar from "~/components/title-bar";
import IconButton from "~/components/ui/icon-button";
import { createLoop } from "~/hooks/loop";
import { useNavigation } from "~/hooks/navigation";
import { t } from "~/lib/i18n";
import { playSound } from "~/lib/sound";
import { localStore } from "~/stores/local";
import IconPlus from "~icons/lucide/plus";
import IconUser from "~icons/lucide/user";

export const Route = createFileRoute("/settings/local-players/")({
  component: LocalPlayersComponent,
});

function LocalPlayersComponent() {
  const [pressed, setPressed] = createSignal(false);
  const navigate = useNavigate();
  let scrollContainer: HTMLDivElement | undefined;
  const buttonRefs: (HTMLButtonElement | undefined)[] = [];

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
      icon: Component<{ class?: string }>;
      action?: () => void;
    }[] = [];

    for (const player of localStore.players()) {
      buttons.push({
        label: player.username,
        icon: IconUser,
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
      icon: IconPlus,
      action: () => {
        navigate({
          to: "/settings/local-players/$id",
          params: {
            id: "new",
          },
        });
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

  createEffect(
    on(
      position,
      () => {
        const selectedButton = buttonRefs[position()];
        console.log(selectedButton, scrollContainer);

        if (selectedButton && scrollContainer) {
          selectedButton.scrollIntoView({
            behavior: "smooth",
            block: "nearest",
            inline: "nearest",
          });
        }
      },
      { defer: true }
    )
  );

  createEffect(on(position, () => playSound("select"), { defer: true }));

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title={t("settings.title")} description={t("settings.sections.localPlayers.title")} onBack={onBack} />}
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <div class="flex w-full flex-grow items-center justify-center gap-4">
        <div ref={scrollContainer} class="styled-scrollbars flex gap-4 overflow-y-auto py-2">
          <For each={buttons()}>
            {(button, index) => (
              <IconButton
                ref={setButtonRef(index())}
                class="flex-shrink-0"
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
