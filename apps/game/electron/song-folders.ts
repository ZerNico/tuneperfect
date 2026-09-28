import { native } from "./native";
import type { JsonStores } from "./store";

/**
 * Grants the native side access to the configured song folders (`settings.json` →
 * `songs.paths`) plus `extra` (e.g. `--songpath`). Folders picked later through the dialog
 * are granted as they are picked, and saved to the settings by the renderer.
 */
export async function grantSongFolders(stores: JsonStores, extra: string[]): Promise<void> {
  const settings = await stores.read("settings.json");
  const songs = settings?.songs as { paths?: unknown } | undefined;
  const configured = Array.isArray(songs?.paths) ? songs.paths.filter((p) => typeof p === "string") : [];

  for (const folder of [...configured, ...extra]) {
    native.allowDirectory(folder);
  }
}
