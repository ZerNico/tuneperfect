import { native } from "./native";
import type { JsonStores } from "./store";

const ALLOWLIST_FILE = "allowed-paths.json";

/**
 * Song folders the app may read, replacing Tauri's persisted fs scope. The native side
 * enforces it for parsing and media serving; this keeps it across restarts.
 */
export class SongFolderAccess {
  readonly #stores: JsonStores;

  constructor(stores: JsonStores) {
    this.#stores = stores;
  }

  /**
   * Restores folders granted in earlier sessions, including the ones configured under the
   * Tauri version (`settings.json` → `songs.paths`), and grants `extra` for this session.
   */
  async restore(extra: string[]): Promise<void> {
    const granted = await this.#granted();
    const settings = (await this.#stores.get("settings.json", "songs")) as { paths?: unknown } | undefined;
    const configured = Array.isArray(settings?.paths) ? settings.paths.filter((p) => typeof p === "string") : [];

    for (const folder of [...granted, ...configured, ...extra]) {
      native.allowDirectory(folder);
    }
  }

  /** Grants a folder the user picked and remembers it. */
  async grant(folder: string): Promise<void> {
    if (!native.allowDirectory(folder)) return;

    const granted = await this.#granted();
    if (!granted.includes(folder)) {
      await this.#stores.set(ALLOWLIST_FILE, "folders", [...granted, folder]);
    }
  }

  async #granted(): Promise<string[]> {
    const folders = await this.#stores.get(ALLOWLIST_FILE, "folders");
    return Array.isArray(folders) ? folders.filter((f) => typeof f === "string") : [];
  }
}
