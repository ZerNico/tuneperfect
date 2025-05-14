import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { open } from "@tauri-apps/plugin-dialog";
import { type Component, For, createEffect, createMemo, createSignal, on } from "solid-js";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import TitleBar from "~/components/title-bar";
import IconButton from "~/components/ui/icon-button";
import { createLoop } from "~/hooks/loop";
import { useNavigation } from "~/hooks/navigation";
import { t } from "~/lib/i18n";
import { playSound } from "~/lib/sound";
import { songsStore } from "~/stores/songs";
import IconFolder from "~icons/lucide/folder";
import IconPlus from "~icons/lucide/plus";

export const Route = createFileRoute("/settings/songs/")({
  component: SongsComponent,
});

function SongsComponent() {
  const [pressed, setPressed] = createSignal(false);
  const [loading, setLoading] = createSignal(false);
  const navigate = useNavigate();
  const onBack = () => {
    playSound("confirm");
    if (songsStore.needsUpdate()) {
      navigate({ to: "/loading", search: { redirect: "/settings" } });
      return;
    }
    navigate({ to: "/settings" });
  };

  const pickFolder = async () => {
    if (loading()) return;
    setLoading(true);

    const path = await open({
      directory: true,
      recursive: true,
    });

    if (path) {
      songsStore.addSongPath(path);
    }

    setLoading(false);
  };

  const folderName = (path: string) => {
    const unixPath = path.replace(/\\/g, "/");
    const name = unixPath.split("/").pop();
    return name || "Unknown";
  };

  const buttons = createMemo(() => {
    const buttons: {
      label: string;
      icon: Component<{ class?: string }>;
      action?: () => void;
      loading?: boolean;
    }[] = [];
    for (const path of songsStore.paths()) {
      buttons.push({
        label: folderName(path),
        icon: IconFolder,
        action: () =>
          navigate({
            to: "/settings/songs/$path",
            params: {
              path: encodeURIComponent(path),
            },
          }),
      });
    }
    buttons.push({ label: t("settings.add"), icon: IconPlus, action: pickFolder, loading: loading() });

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

  createEffect(on(position, () => playSound("select"), { defer: true }));

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title={t("settings.title")} description={t("settings.sections.songs.title")} onBack={onBack} />}
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
              loading={button.loading}
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
