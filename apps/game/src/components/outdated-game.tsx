import { Show } from "solid-js";

import TagChip from "~/components/fx/tag-chip";
import type { MenuItem } from "~/components/menu";
import Menu from "~/components/menu";
import { t } from "~/lib/i18n";

interface OutdatedGameProps {
  /** Only a package manager can update this install (deb/rpm). */
  packageManager: boolean;
  /** The update this installation can install itself, if any. */
  update?: { version: string } | null;
  onInstall: () => void;
  onPlayOffline: () => void;
}

/** This version may no longer go online: update, or play offline (never a hard block). */
export default function OutdatedGame(props: OutdatedGameProps) {
  const items = (): MenuItem[] => [
    ...(props.update ? [{ type: "button" as const, label: t("update.install"), action: props.onInstall }] : []),
    { type: "button", label: t("update.playOffline"), action: props.onPlayOffline },
  ];

  return (
    <div class="flex w-full grow flex-col justify-center">
      <div class="mb-[10cqh] flex flex-col items-center gap-3">
        <h1 class="text-center text-5xl font-bold">{t("update.outdated")}</h1>
        <span class="text-center text-xl font-bold text-white/80">
          {props.packageManager ? t("update.packageManager") : t("update.updateToPlay")}
        </span>
        <Show when={props.update}>
          {(update) => <TagChip label={t("update.version")} accent={update().version} class="text-lg" />}
        </Show>
      </div>
      <Menu items={items()} gradient="gradient-settings" class="h-min grow-0" />
    </div>
  );
}
