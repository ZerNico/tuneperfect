import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { open } from "@tauri-apps/plugin-dialog";
import { createEffect, createMemo, createSignal, For, type JSX, on } from "solid-js";
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

  const getSongCount = (path: string) => {
    if (!songsStore.localSongs.has(path)) {
      return undefined;
    }
    const songs = songsStore.localSongs.get(path) || [];
    return `${songs.length} ${t("sing.songs")}`;
  };

  const buttons = createMemo(() => {
    const buttons: {
      label: string;
      subtitle?: string;
      icon: JSX.Element;
      action?: () => void;
      loading?: boolean;
    }[] = [];
    for (const path of songsStore.paths()) {
      buttons.push({
        label: folderName(path),
        subtitle: getSongCount(path),
        icon: <IconFolder class="text-6xl" />,
        action: () =>
          navigate({
            to: "/settings/songs/$path",
            params: {
              path: encodeURIComponent(path),
            },
          }),
      });
    }

    if (songsStore.paths().length < 7) {
      buttons.push({
        label: t("settings.add"),
        icon: <IconPlus class="text-6xl" />,
        action: pickFolder,
        loading: loading(),
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
              subtitle={button.subtitle}
              gradient="gradient-settings"
            />
          )}
        </For>
      </div>
    </Layout>
  );
}
