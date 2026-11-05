import { native } from "./native";
import type { JsonStores } from "./store";

/**
 * The song folders the native side may read (and `media://` may serve): the configured ones
 * (`settings.json` → `songs.paths`) and `--songpath` ones as of startup, plus folders picked
 * through the dialog. Only these are ever granted, so the renderer writing a path into the
 * settings doesn't grant it before the next start.
 */
export class SongFolders {
  private readonly folders: Set<string>;

  private constructor(folders: Iterable<string>) {
    this.folders = new Set(folders);
    this.grantKnown();
  }

  /** The configured folders plus `extra` (e.g. `--songpath`), granted. */
  static async atStartup(stores: JsonStores, extra: string[]): Promise<SongFolders> {
    const settings = await stores.read("settings.json");
    const songs = settings?.songs as { paths?: unknown } | undefined;
    const configured = Array.isArray(songs?.paths) ? songs.paths.filter((p) => typeof p === "string") : [];
    return new SongFolders([...configured, ...extra]);
  }

  /** Grants a folder the user picked; `false` if it doesn't exist. The renderer saves it to the settings. */
  pick(folder: string): boolean {
    if (!native.allowDirectory(folder)) return false;
    this.folders.add(folder);
    return true;
  }

  /** Grants every known folder that exists right now, so one that was missing (an unplugged drive) can be read once it's back. */
  grantKnown(): void {
    for (const folder of this.folders) native.allowDirectory(folder);
  }
}
