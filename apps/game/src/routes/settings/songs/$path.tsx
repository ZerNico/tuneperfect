import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";
import { songsStore } from "~/stores/songs";

export const Route = createFileRoute("/settings/songs/$path")({
  component: SongsComponent,
});

function SongsComponent() {
  const navigate = useNavigate();

  const onBack = () => navigate({ to: "/settings/songs" });

  const params = Route.useParams();
  const path = () => decodeURIComponent(params().path);

  const removePath = () => {
    songsStore.removeSongPath(path());
    onBack();
  };

  const menuItems: MenuItem[] = [
    {
      type: "button",
      label: t("settings.remove"),
      action: removePath,
    },
  ];

  return (
    <Layout
      intent="secondary"
      header={
        <TitleBar
          title={t("settings.title")}
          description={`${t("settings.sections.songs.title")} / ${path()}`}
          onBack={onBack}
        />
      }
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <Menu items={menuItems} onBack={onBack} />
    </Layout>
  );
}
