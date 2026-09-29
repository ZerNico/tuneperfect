import { useNavigate, getRouteApi } from "@tanstack/solid-router";

import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import SettingsFooter from "~/components/settings-footer";
import TitleBar from "~/components/title-bar";
import { t } from "~/lib/i18n";
import { songsStore } from "~/stores/songs";

const route = getRouteApi("/settings/songs/$path");

export default function SongsScreen() {
  const navigate = useNavigate();

  const onBack = () => navigate({ to: "/settings/songs" });

  const params = route.useParams();
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
      footer={<SettingsFooter />}
    >
      <Menu items={menuItems} onBack={onBack} />
    </Layout>
  );
}
