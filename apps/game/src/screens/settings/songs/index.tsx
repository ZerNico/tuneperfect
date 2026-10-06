import { useNavigate } from "@tanstack/solid-router";
import { createMemo, createSignal } from "solid-js";
import IconFolder from "~icons/ph/folder-fill";

import Layout from "~/components/layout";
import SettingsFooter from "~/components/settings-footer";
import TitleBar from "~/components/title-bar";
import CardGrid, { type GridCard } from "~/components/ui/card-grid";
import { t } from "~/lib/i18n";
import { native } from "~/lib/native/client";
import { playSound } from "~/lib/sound";
import { folderName } from "~/lib/utils/path";
import { songsStore } from "~/stores/songs";

export default function SongsScreen() {
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

    const path = await native.dialog.pickFolder().catch(() => null);

    if (path) {
      songsStore.addSongPath(path);
    }

    setLoading(false);
  };

  const getSongCount = (path: string) => {
    if (!songsStore.localSongs.has(path)) {
      return undefined;
    }
    const songs = songsStore.localSongs.get(path) || [];
    return `${songs.length} ${t("sing.songs")}`;
  };

  const cards = createMemo(() => {
    const cards: GridCard[] = songsStore.paths().map((path) => ({
      id: path,
      label: folderName(path),
      subtitle: getSongCount(path),
      visual: <IconFolder />,
      action: () => navigate({ to: "/settings/songs/$path", params: { path: encodeURIComponent(path) } }),
    }));

    if (songsStore.paths().length < 7) {
      cards.push({ id: "add", label: t("settings.add"), add: true, loading: loading(), action: pickFolder });
    }

    return cards;
  });

  return (
    <Layout
      intent="secondary"
      header={<TitleBar title={t("settings.title")} description={t("settings.sections.songs.title")} onBack={onBack} />}
      footer={<SettingsFooter />}
    >
      <div class="flex h-full items-center">
        <CardGrid cards={cards()} onBack={onBack} />
      </div>
    </Layout>
  );
}
