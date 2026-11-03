import { native } from "./native";
import type { JsonStores } from "./store";

/**
 * The song folders the native side may read (and `media://` may serve): the configured ones
 * (`settings.json` → `songs.paths`) and `--songpath` ones as of startup, plus folders picked
 * through the dialog. Only these can be granted again later (`regrant`), so the renderer
 * writing a path into the settings doesn't grant it before the next start.
 */
export class SongFolders {
  private readonly folders = new Set<string>();

  /** Grants the configured folders plus `extra` (e.g. `--songpath`). */
  static async atStartup(stores: JsonStores, extra: string[]): Promise<SongFolders> {
    const settings = await stores.read("settings.json");
    const songs = settings?.songs as { paths?: unknown } | undefined;
    const configured = Array.isArray(songs?.paths) ? songs.paths.filter((p) => typeof p === "string") : [];

    const folders = new SongFolders();
    for (const folder of [...configured, ...extra]) folders.folders.add(folder);
    folders.regrant();
    return folders;
  }

  /** Grants a folder the user picked; `false` if it doesn't exist. The renderer saves it to the settings. */
  pick(folder: string): boolean {
    if (!native.allowDirectory(folder)) return false;
    this.folders.add(folder);
    return true;
  }

  /**
   * Grants the known folders again, so one that was missing (an unplugged drive) can be parsed
   * once it's back. Returns the ones that exist.
   */
  regrant(): string[] {
    return [...this.folders].filter((folder) => native.allowDirectory(folder));
  }
}
