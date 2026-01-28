import { createFileRoute, useNavigate } from "@tanstack/solid-router";
import { open } from "@tauri-apps/plugin-dialog";
import { readFile } from "@tauri-apps/plugin-fs";
import { createMemo, createSignal } from "solid-js";
import KeyHints from "~/components/key-hints";
import Layout from "~/components/layout";
import Menu, { type MenuItem } from "~/components/menu";
import TitleBar from "~/components/title-bar";
import Avatar from "~/components/ui/avatar";
import ImageCrop from "~/components/ui/image-crop";
import { t } from "~/lib/i18n";
import { popup } from "~/lib/popup";
import { blobToDataUrl } from "~/lib/utils";
import { localStore } from "~/stores/local";

export const Route = createFileRoute("/settings/local-players/$id")({
  component: LocalPlayerComponent,
});

function LocalPlayerComponent() {
  const navigate = useNavigate();
  const onBack = () => {
    navigate({ to: "/settings/local-players" });
  };

  const params = Route.useParams();
  const isNew = () => params().id === "new";

  const existingPlayer = () => {
    if (isNew()) return null;
    return localStore.getPlayer(params().id);
  };

  const [playerName, setPlayerName] = createSignal(existingPlayer()?.username || "");
  const [playerImage, setPlayerImage] = createSignal<string | undefined>(existingPlayer()?.image);

  const deletePlayer = () => {
    if (!isNew()) {
      localStore.deletePlayer(params().id);
    }
    onBack();
  };

  const savePlayer = () => {
    const name = playerName().trim();
    if (!name) {
      return;
    }

    if (isNew()) {
      const newPlayer = localStore.addPlayer(name);
      // Update with image if one was selected
      const image = playerImage();
      if (image) {
        localStore.updatePlayer(newPlayer.id, { image });
      }
    } else {
      localStore.updatePlayer(params().id, { username: name, image: playerImage() });
    }
    onBack();
  };

  const openImagePicker = async () => {
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: "Images",
          extensions: ["png", "jpg", "jpeg", "webp"],
        },
      ],
    });

    if (selected) {
      // Read the file and convert to data URL for cropping
      const fileData = await readFile(selected);
      const blob = new Blob([fileData]);
      const dataUrl = await blobToDataUrl(blob);

      const croppedImage = await popup.show<string | null>({
        render: (resolve) => (
          <ImageCrop imageUrl={dataUrl} onCrop={(data) => resolve(data)} onCancel={() => resolve(null)} layer={1} />
        ),
      });

      if (croppedImage) {
        setPlayerImage(croppedImage);
      }
    }
  };

  const removeAvatar = () => {
    setPlayerImage(undefined);
  };

  const avatarUser = createMemo(() => ({
    username: playerName() || "?",
    image: playerImage(),
  }));

  const menuItems = createMemo((): MenuItem[] => {
    const items: MenuItem[] = [
      {
        type: "custom",
        interactive: false,
        render: () => (
          <div class="flex justify-center py-4">
            <Avatar user={avatarUser()} class="h-24 w-24 text-3xl" />
          </div>
        ),
      },
      {
        type: "input",
        label: t("settings.sections.localPlayers.name"),
        value: () => playerName(),
        onInput: setPlayerName,
        placeholder: t("settings.sections.localPlayers.enterName"),
        maxLength: 32,
      },
      {
        type: "button",
        label: t("settings.sections.localPlayers.changeAvatar"),
        action: openImagePicker,
      },
    ];

    // Only show remove avatar option if there's an image
    if (playerImage()) {
      items.push({
        type: "button",
        label: t("settings.sections.localPlayers.removeAvatar"),
        action: removeAvatar,
      });
    }

    if (!isNew()) {
      items.push({
        type: "button",
        label: t("settings.delete"),
        action: deletePlayer,
      });
    }

    items.push({
      type: "button",
      label: t("settings.save"),
      action: savePlayer,
    });

    return items;
  });

  return (
    <Layout
      intent="secondary"
      header={
        <TitleBar
          title={t("settings.title")}
          description={isNew() ? t("settings.sections.localPlayers.addNew") : t("settings.sections.localPlayers.edit")}
          onBack={onBack}
        />
      }
      footer={<KeyHints hints={["back", "navigate", "confirm"]} />}
    >
      <Menu items={menuItems()} onBack={onBack} />
    </Layout>
  );
}
